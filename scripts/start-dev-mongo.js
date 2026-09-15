#!/usr/bin/env node
// A persistent, project-local single-node MongoDB replica set for real
// local development — distinct from tests/helpers/testMongo.js, which
// spins up a disposable one per test run and tears it down after. This
// one is meant to survive across restarts (real dev data lives here:
// Stage 9's migrated school, seeded accounts, anything created while
// clicking around the app).
//
// Why a replica set at all for local dev: several real endpoints use
// multi-document transactions (controllers/platform/school.controller.js's
// createSchool, the one that actually creates a School + its first Staff
// admin + a Subscription atomically) — MongoDB transactions require a
// replica set (or mongos), full stop, a standalone mongod rejects them
// outright. Real MongoDB Atlas is always a replica set, so this only
// matters for local dev.
//
// Deliberately NOT touching the system mongod service (/etc/mongod.conf,
// port 27017) — that's shared, sudo-gated, and reconfiguring it to add
// --replSet would need a restart that could affect anything else using
// it on this machine. This spins up a second, independent mongod on its
// own port/dbpath instead: no sudo, fully reversible, doesn't touch
// anything outside this project.
//
// Usage: node scripts/start-dev-mongo.js
// Idempotent — if it's already running (checked by actually pinging the
// port, not just a pidfile), this just confirms that and exits.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = 27018;
const DATA_DIR = path.join(__dirname, '..', '.dev-data', 'mongo');
const DIRECT_URI = `mongodb://127.0.0.1:${PORT}/`;
const REPLICA_SET_URI = `mongodb://127.0.0.1:${PORT}/schoolmanagementapp?replicaSet=rs0`;

async function isReachable() {
	try {
		const client = new MongoClient(DIRECT_URI, { directConnection: true, serverSelectionTimeoutMS: 1000 });
		await client.connect();
		await client.db('admin').command({ ping: 1 });
		await client.close();
		return true;
	} catch {
		return false;
	}
}

async function isPrimary() {
	try {
		const client = new MongoClient(DIRECT_URI, { directConnection: true, serverSelectionTimeoutMS: 1000 });
		await client.connect();
		const res = await client.db('admin').command({ hello: 1 });
		await client.close();
		return Boolean(res.isWritablePrimary);
	} catch {
		return false;
	}
}

async function waitFor(check, retries = 40) {
	for (let i = 0; i < retries; i++) {
		if (await check()) return true;
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

async function main() {
	if (await isReachable()) {
		if (await isPrimary()) {
			console.log(`[dev-mongo] already running and PRIMARY at ${REPLICA_SET_URI}`);
			return;
		}
		console.log('[dev-mongo] a mongod is already on this port but not yet PRIMARY — waiting...');
		const ok = await waitFor(isPrimary);
		if (!ok) throw new Error('mongod on this port never became PRIMARY — check for a conflicting process.');
		console.log(`[dev-mongo] now PRIMARY at ${REPLICA_SET_URI}`);
		return;
	}

	fs.mkdirSync(DATA_DIR, { recursive: true });

	const logPath = path.join(DATA_DIR, 'mongod.log');
	const child = spawn(
		'mongod',
		['--replSet', 'rs0', '--port', String(PORT), '--dbpath', DATA_DIR, '--bind_ip', '127.0.0.1', '--logpath', logPath],
		{ detached: true, stdio: 'ignore' }
	);
	child.unref();
	console.log(`[dev-mongo] started mongod (pid ${child.pid}), data dir: ${DATA_DIR}`);

	const reachable = await waitFor(isReachable);
	if (!reachable) throw new Error(`mongod never became reachable — check ${logPath}`);

	const isFreshInit = !fs.existsSync(path.join(DATA_DIR, '.replset-initiated'));
	if (isFreshInit) {
		const client = new MongoClient(DIRECT_URI, { directConnection: true });
		await client.connect();
		await client.db('admin').command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${PORT}` }] } });
		await client.close();
		fs.writeFileSync(path.join(DATA_DIR, '.replset-initiated'), new Date().toISOString());
		console.log('[dev-mongo] replica set initiated');
	}

	const ok = await waitFor(isPrimary);
	if (!ok) throw new Error('mongod never became PRIMARY after replSetInitiate.');

	console.log(`[dev-mongo] ready at ${REPLICA_SET_URI}`);
	console.log('[dev-mongo] set DATABASE to this URI in .env, then run your migration/seed scripts against it.');
}

main().catch((err) => {
	console.error('[dev-mongo] FAILED:', err.message);
	process.exit(1);
});
