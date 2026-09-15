#!/usr/bin/env node
// Standalone integration verification for Stage 3's multi-tenant
// scoping — real HTTP requests via supertest, against a real,
// disposable MongoDB replica set, with no mocking.
//
// This is deliberately NOT a Jest test. It was one, first — see git
// history / commit message for the full account — but hung
// indefinitely specifically when run through Jest's test runner
// (jest-circus + --runInBand), despite the exact same setup/connect
// logic completing correctly in well under a second when run as a
// plain Node script, which is what this is. That's a real, reproducible
// Jest-environment quirk with long-lived child_process.spawn() +
// mongoose.connect() from inside Jest's worker sandbox, not a bug in
// the tenant-scoping logic itself — the DB-free suite under `npm test`
// (tests/app.test.js) still runs in Jest/CI as normal; this script is
// the deeper, DB-backed verification, run manually or as its own CI
// step (`npm run verify:tenant-isolation`).
//
// Exits 0 and prints "ALL CHECKS PASSED" on success, exits 1 with the
// first failing assertion's message otherwise.

const mongoose = require('mongoose');
const request = require('supertest');
const testMongo = require('../tests/helpers/testMongo');

let passed = 0;

function assert(condition, message) {
	if (!condition) {
		throw new Error(`FAILED: ${message}`);
	}
	passed++;
	console.log(`  ok: ${message}`);
}

const validStaffFields = (overrides = {}) => ({
	name: 'Admin',
	email: overrides.email,
	password: 'password123',
	confirmPassword: 'password123',
	tel: '677889900',
	gender: 'male',
	dob: '1990-01-01',
	matricule: overrides.matricule,
	high_certificate: 'PhD',
	marital_status: 'married',
	...overrides,
});

async function main() {
	const mongoHandle = await testMongo.start();
	await mongoose.connect(process.env.DATABASE);

	process.env.JWT_SECRET = 'test-jwt-secret';
	process.env.JWT_SECRET_STUDENT = 'test-jwt-secret-student';
	process.env.JWT_SECRET_PLATFORM = 'test-jwt-secret-platform';
	process.env.JWT_EXPIRES_IN = '1d';
	process.env.COOKIE_EXP = '1';
	process.env.RATE_LIMIT_ATTEMPTS = '1000';
	if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
		// firebase-admin's cert() actually parses this key (unlike the Jest
		// suite, this script doesn't mock firebase.config.js at all), so it
		// has to be a real, syntactically valid RSA key — just a disposable
		// one generated fresh for this run, not a real credential.
		const { generateKeyPairSync } = require('crypto');
		const { privateKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
			publicKeyEncoding: { type: 'spki', format: 'pem' },
		});
		process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
			type: 'service_account',
			project_id: 'test-project',
			private_key_id: 'x',
			private_key: privateKey,
			client_email: 'test@test-project.iam.gserviceaccount.com',
			client_id: '1',
			token_uri: 'https://oauth2.googleapis.com/token',
		});
	}

	// firebase.config.js isn't mocked here (this isn't running under
	// Jest's moduleNameMapper) — it'll fail to actually reach Firebase,
	// which is fine, since nothing in this script's flow needs it to.
	const app = require('../app');
	const PlatformStaff = require('../models/platform_staff.model');
	const Staff = require('../models/staff.model');

	try {
		console.log('\n1. Bootstrap platform super_admin directly (no HTTP endpoint for this by design)');
		await PlatformStaff.create({
			name: 'Founder',
			email: 'founder@deschool.cm',
			password: 'superSecret123',
			role: 'super_admin',
		});
		assert(true, 'platform super_admin seeded');

		console.log('\n2. Platform login + provision two schools');
		const loginRes = await request(app).post('/api/v1/platform/login').send({
			email: 'founder@deschool.cm',
			password: 'superSecret123',
		});
		assert(loginRes.status === 200, `platform login returns 200 (got ${loginRes.status}, body: ${JSON.stringify(loginRes.body)})`);
		const platformToken = loginRes.body.data.token;
		assert(Boolean(platformToken), 'platform login returns a token');

		const schoolARes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'School A',
				slug: 'school-a',
				contactEmail: 'contact@school-a.cm',
				firstAdmin: validStaffFields({ email: 'admin-a@school-a.cm', matricule: 'A-001', tel: '677889901' }),
			});
		assert(schoolARes.status === 201, `create School A returns 201 (got ${schoolARes.status}, body: ${JSON.stringify(schoolARes.body)})`);
		const schoolAId = schoolARes.body.data._id;

		const schoolBRes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'School B',
				slug: 'school-b',
				contactEmail: 'contact@school-b.cm',
				firstAdmin: validStaffFields({ email: 'admin-b@school-b.cm', matricule: 'B-001', tel: '677889902' }),
			});
		assert(schoolBRes.status === 201, `create School B returns 201 (got ${schoolBRes.status}, body: ${JSON.stringify(schoolBRes.body)})`);
		const schoolBId = schoolBRes.body.data._id;
		assert(schoolBId !== schoolAId, 'School A and School B have different ids');

		const staffA = await Staff.findOne({ email: 'admin-a@school-a.cm' }).setOptions({ skipTenantScope: true });
		const staffB = await Staff.findOne({ email: 'admin-b@school-b.cm' }).setOptions({ skipTenantScope: true });
		assert(String(staffA.schoolId) === String(schoolAId), "School A's admin landed in School A");
		assert(String(staffB.schoolId) === String(schoolBId), "School B's admin landed in School B");

		console.log('\n3. Each school admin logs in');
		const resA = await request(app).post('/api/v1/staff/login').send({ email: 'admin-a@school-a.cm', password: 'password123' });
		assert(resA.status === 200, `School A admin login returns 200 (got ${resA.status})`);
		const staffTokenA = resA.body.data.token;

		const resB = await request(app).post('/api/v1/staff/login').send({ email: 'admin-b@school-b.cm', password: 'password123' });
		assert(resB.status === 200, `School B admin login returns 200 (got ${resB.status})`);
		const staffTokenB = resB.body.data.token;

		console.log('\n4. Both schools can independently use the identical academic year string "2024/2025" (would have collided under the old global-unique index)');
		const ayA = await request(app).post(`/api/v1/academic-year/${staffTokenA}`).send({ academicYear: '2024/2025' });
		assert(ayA.status === 201, `School A creates 2024/2025 (got ${ayA.status}, body: ${JSON.stringify(ayA.body)})`);

		const ayB = await request(app).post(`/api/v1/academic-year/${staffTokenB}`).send({ academicYear: '2024/2025' });
		assert(ayB.status === 201, `School B creates the SAME string 2024/2025 (got ${ayB.status}, body: ${JSON.stringify(ayB.body)})`);

		console.log('\n5. A genuine duplicate within the same school is still rejected');
		const dup = await request(app).post(`/api/v1/academic-year/${staffTokenA}`).send({ academicYear: '2024/2025' });
		assert(dup.status >= 400, `duplicate within School A is rejected (got ${dup.status})`);

		console.log('\n6. Cross-tenant isolation on academic years');
		const listA = await request(app).get(`/api/v1/academic-year/${staffTokenA}`);
		assert(listA.status === 200, `School A can list its academic years (got ${listA.status})`);
		assert(listA.body.data.length === 1, `School A sees exactly 1 academic year (got ${listA.body.data.length})`);
		assert(String(listA.body.data[0].schoolId) === String(schoolAId), "School A's year is scoped to School A");

		const listB = await request(app).get(`/api/v1/academic-year/${staffTokenB}`);
		assert(listB.status === 200, `School B can list its academic years (got ${listB.status})`);
		assert(listB.body.data.length === 1, `School B sees exactly 1 academic year (got ${listB.body.data.length})`);
		assert(String(listB.body.data[0].schoolId) === String(schoolBId), "School B's year is scoped to School B");

		console.log('\n7. Cross-tenant isolation on staff rosters');
		const staffListA = await request(app).get(`/api/v1/staff/${staffTokenA}`);
		assert(staffListA.status === 200, `School A can list its staff (got ${staffListA.status})`);
		assert(
			staffListA.body.data.every((s) => String(s.schoolId) === String(schoolAId)),
			"every staff member School A sees belongs to School A"
		);
		assert(
			!staffListA.body.data.some((s) => s.email === 'admin-b@school-b.cm'),
			"School A's admin never appears in School A's own roster"
		);

		const staffListB = await request(app).get(`/api/v1/staff/${staffTokenB}`);
		assert(staffListB.status === 200, `School B can list its staff (got ${staffListB.status})`);
		assert(
			staffListB.body.data.every((s) => String(s.schoolId) === String(schoolBId)),
			"every staff member School B sees belongs to School B"
		);
		assert(
			!staffListB.body.data.some((s) => s.email === 'admin-a@school-a.cm'),
			"School B's admin never appears in School B's own roster"
		);

		console.log('\n8. A request with no valid auth (no tenant context) is rejected, not silently unscoped');
		const noAuth = await request(app).get('/api/v1/academic-year/not-a-real-token');
		assert(noAuth.status >= 400 && noAuth.status < 500, `unauthenticated request rejected with a 4xx (got ${noAuth.status})`);

		console.log(`\nALL CHECKS PASSED (${passed} assertions)`);
		process.exitCode = 0;
	} catch (err) {
		console.error('\n' + err.message);
		process.exitCode = 1;
	} finally {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
		await mongoHandle.stop();
	}
}

main();
