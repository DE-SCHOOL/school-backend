#!/usr/bin/env node
// Stage 10's own explicit item: "Load-test the canteen flow specifically
// — it's the one feature with a real concurrent-burst usage pattern
// (lunch rush across potentially many students at once)." Real,
// disposable MongoDB replica set + real HTTP requests via supertest, no
// mocking — same pattern as scripts/verify-tenant-isolation.js.
//
// This is what actually found the lost-update race fixed in
// controllers/canteen/canteen.controller.js's purchase handler: a plain
// findOne()+mutate+save() lets two concurrent purchases both read the
// same starting balance and both "succeed", with the second .save()
// silently clobbering the first's deduction. Run with
// `git stash` on that fix to see this script fail against the old code.

const mongoose = require('mongoose');
const request = require('supertest');
const testMongo = require('../tests/helpers/testMongo');

let passed = 0;
function assert(condition, message) {
	if (!condition) throw new Error(`FAILED: ${message}`);
	passed++;
	console.log(`  ok: ${message}`);
}

async function main() {
	const mongoHandle = await testMongo.start();
	await mongoose.connect(process.env.DATABASE);

	process.env.JWT_SECRET = 'test-jwt-secret';
	process.env.JWT_SECRET_STUDENT = 'test-jwt-secret-student';
	process.env.JWT_SECRET_PLATFORM = 'test-jwt-secret-platform';
	process.env.JWT_EXPIRES_IN = '1d';
	process.env.COOKIE_EXP = '1';
	process.env.RATE_LIMIT_ATTEMPTS = '100000';
	if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
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

	const app = require('../app');
	const PlatformStaff = require('../models/platform_staff.model');
	const Subscription = require('../models/subscription.model');
	const CanteenAccount = require('../models/canteen_account.model');
	const CanteenTransaction = require('../models/canteen_transaction.model');
	const Student = require('../models/students.model');
	const Specialty = require('../models/specialty.model');
	const Department = require('../models/department.model');
	const Program = require('../models/programs.model');
	const Staff = require('../models/staff.model');
	const tenantContext = require('../utilities/tenantContext');

	try {
		console.log('\n1. Bootstrap a school on the "standard" plan (canteen is entitled) with a canteen-authorized staff member');
		await PlatformStaff.create({ name: 'Founder', email: 'founder@deschool.cm', password: 'superSecret123', role: 'super_admin' });
		const platformLogin = await request(app).post('/api/v1/platform/login').send({ email: 'founder@deschool.cm', password: 'superSecret123' });
		const platformToken = platformLogin.body.data.token;

		const schoolRes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'Load Test School',
				slug: 'load-test-school',
				contactEmail: 'contact@load-test.cm',
				plan: 'standard',
				firstAdmin: {
					name: 'Canteen Staff',
					email: 'canteen-staff@load-test.cm',
					password: 'password123',
					confirmPassword: 'password123',
					tel: '677889900',
					gender: 'male',
					dob: '1990-01-01',
					matricule: 'CS-001',
					high_certificate: 'PhD',
					marital_status: 'married',
				},
			});
		assert(schoolRes.status === 201, `school created (got ${schoolRes.status}, body: ${JSON.stringify(schoolRes.body)})`);
		const schoolId = schoolRes.body.data._id;

		await Subscription.updateOne({ schoolId }, { status: 'active' });

		const staffLogin = await request(app).post('/api/v1/staff/login').send({ email: 'canteen-staff@load-test.cm', password: 'password123' });
		assert(staffLogin.status === 200, `staff login works (got ${staffLogin.status})`);
		const staffToken = staffLogin.body.data.token;

		console.log('\n2. Seed a student, a canteen item, and a starting balance that covers exactly 10 purchases');
		let studentId, itemId;
		const UNIT_PRICE = 500;
		const STARTING_BALANCE = 5000; // exactly 10 purchases' worth
		const CONCURRENT_REQUESTS = 25; // well over what the balance can cover

		await tenantContext.run({ schoolId }, async () => {
			const hod = await Staff.findOne({ email: 'canteen-staff@load-test.cm' }).setOptions({ skipTenantScope: true });
			const program = await Program.create({ name: 'General Program', director: hod._id, deputyDirector: hod._id });
			const department = await Department.create({ name: 'General Studies', hod: hod._id, program: program._id });
			const specialty = await Specialty.create({ name: 'General', department: department._id, level: 100 });
			const student = await Student.create({
				name: 'Load Test Student',
				matricule: 'LT-STU-001',
				specialty: specialty._id,
				gender: 'male',
				dob: new Date('2010-01-01'),
				parent_name: 'Parent',
				parent_tel: 677001122,
				level: 100,
			});
			studentId = student._id;

			const itemRes = await request(app)
				.post(`/api/v1/canteen/items/${staffToken}`)
				.send({ name: 'Meal', priceXAF: UNIT_PRICE, available: true });
			assert(itemRes.status === 201, `canteen item created (got ${itemRes.status}, body: ${JSON.stringify(itemRes.body)})`);
			itemId = itemRes.body.data._id;

			await CanteenAccount.create({ studentId, balanceXAF: STARTING_BALANCE });
		});

		console.log(`\n3. Fire ${CONCURRENT_REQUESTS} concurrent purchase requests of ${UNIT_PRICE} XAF each against a ${STARTING_BALANCE} XAF balance (only 10 should succeed)`);
		const results = await Promise.all(
			Array.from({ length: CONCURRENT_REQUESTS }, () =>
				request(app)
					.post(`/api/v1/canteen/purchase/${staffToken}`)
					.send({ studentId, items: [{ canteenItemId: itemId, qty: 1 }] })
			)
		);

		const succeeded = results.filter((r) => r.status === 201);
		const rejected = results.filter((r) => r.status === 402);
		const unexpected = results.filter((r) => r.status !== 201 && r.status !== 402);

		console.log(`  ${succeeded.length} succeeded, ${rejected.length} rejected as insufficient balance, ${unexpected.length} unexpected`);
		assert(unexpected.length === 0, `no unexpected response statuses (saw: ${unexpected.map((r) => r.status).join(',')})`);
		assert(succeeded.length === 10, `exactly 10 purchases succeeded, matching what the balance can actually cover (got ${succeeded.length})`);
		assert(rejected.length === CONCURRENT_REQUESTS - 10, `the remaining ${CONCURRENT_REQUESTS - 10} were correctly rejected as insufficient balance (got ${rejected.length})`);

		console.log('\n4. Final balance and transaction ledger are exactly correct — no lost updates, no double-spend, never negative');
		await tenantContext.run({ schoolId }, async () => {
			const account = await CanteenAccount.findOne({ studentId });
			assert(account.balanceXAF === 0, `final balance is exactly 0 (got ${account.balanceXAF}) — a lost-update race would leave stale balance > 0 despite 10 reported successes`);
			assert(account.balanceXAF >= 0, 'balance never went negative');

			const txCount = await CanteenTransaction.countDocuments({ studentId });
			assert(txCount === 10, `exactly 10 transaction records were written, matching the 10 successful HTTP responses (got ${txCount})`);

			const txTotal = (await CanteenTransaction.find({ studentId })).reduce((sum, t) => sum + t.amountXAF, 0);
			assert(txTotal === STARTING_BALANCE, `transaction ledger sums to the full starting balance (${txTotal} == ${STARTING_BALANCE})`);
		});

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
