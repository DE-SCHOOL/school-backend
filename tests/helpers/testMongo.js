const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { MongoClient } = require('mongodb');

function getFreePort() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.listen(0, () => {
			const { port } = srv.address();
			srv.close(() => resolve(port));
		});
		srv.on('error', reject);
	});
}

// directConnection: true throughout — without it, the driver's server
// discovery hangs indefinitely against a mongod that has --replSet set
// but isn't a confirmed primary yet.
async function waitReachable(uri, retries = 40) {
	for (let i = 0; i < retries; i++) {
		try {
			const client = new MongoClient(uri, {
				directConnection: true,
				serverSelectionTimeoutMS: 1000,
			});
			await client.connect();
			await client.db('admin').command({ ping: 1 });
			await client.close();
			return;
		} catch (err) {
			if (i === retries - 1) throw err;
			await new Promise((r) => setTimeout(r, 500));
		}
	}
}

// A single-node replica set still runs its (near-instant, but not
// zero-time) self-election after replSetInitiate before it reports
// isWritablePrimary. mongoose.connect() uses normal discovery-based
// connection (no directConnection), which needs a real primary to
// resolve against — connecting too early is what caused this suite to
// hang indefinitely on mongoose.connect() during development, even
// though a direct connection to the same node succeeded immediately.
async function waitForPrimary(uri, retries = 40) {
	for (let i = 0; i < retries; i++) {
		try {
			const client = new MongoClient(uri, {
				directConnection: true,
				serverSelectionTimeoutMS: 1000,
			});
			await client.connect();
			const res = await client.db('admin').command({ hello: 1 });
			await client.close();
			if (res.isWritablePrimary) return;
		} catch (err) {
			// keep retrying
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`mongod at ${uri} never became primary`);
}

// Spawns a real, disposable single-node MongoDB replica set for
// integration tests, in the SAME process that will go on to
// mongoose.connect() against it — deliberately not a Jest
// globalSetup/globalTeardown pair. That was tried first and proved
// unreliable: globalSetup and the actual test file run as separate Jest
// process invocations, and something about that boundary (despite the
// mongod process itself being independently confirmed healthy and
// PRIMARY via a plain mongosh check while the test was hung) made
// mongoose.connect() in the test file hang indefinitely even with a
// correct connection string. Calling this directly from the test file's
// own beforeAll/afterAll removes that boundary entirely, and mirrors
// exactly the standalone script that was used to verify each piece of
// this logic works.
//
// Started as a replica set, not standalone: any test that exercises a
// multi-document transaction (see school.controller.js's createSchool)
// needs one — a standalone mongod rejects transactions outright, and
// real production MongoDB hosting is a replica set by default anyway.
//
// If DATABASE is already set (e.g. a CI service container providing a
// real MongoDB), this returns immediately and stop() is a no-op —
// callers always call start()/stop() and don't need to know which case
// they're in.
async function start() {
	if (process.env.DATABASE) {
		return { stop: async () => {} };
	}

	const port = await getFreePort();
	const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'de-school-test-mongo-'));

	const child = spawn(
		'mongod',
		[
			'--replSet',
			'rs0',
			'--port',
			String(port),
			'--dbpath',
			dbPath,
			'--bind_ip',
			'127.0.0.1',
			'--quiet',
		],
		{ stdio: 'ignore' }
	);

	const directUri = `mongodb://127.0.0.1:${port}/`;
	await waitReachable(directUri);

	const client = new MongoClient(directUri, { directConnection: true });
	await client.connect();
	await client.db('admin').command({
		replSetInitiate: {
			_id: 'rs0',
			members: [{ _id: 0, host: `127.0.0.1:${port}` }],
		},
	});
	await client.close();

	await waitForPrimary(directUri);

	process.env.DATABASE = `mongodb://127.0.0.1:${port}/de-school-test?replicaSet=rs0`;

	return {
		stop: async () => {
			// child.kill() only sends the signal — it doesn't wait for the
			// process to actually exit (mongod's shutdown flushes WiredTiger
			// and takes a moment), so without waiting here the calling
			// script's own process can exit first and leave mongod running
			// as an orphan. SIGKILL after a grace period in case it doesn't
			// shut down cleanly.
			await new Promise((resolve) => {
				const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
				child.once('exit', () => {
					clearTimeout(timer);
					resolve();
				});
				child.kill();
			});
			fs.rmSync(dbPath, { recursive: true, force: true });
		},
	};
}

module.exports = { start };
