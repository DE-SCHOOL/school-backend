#!/usr/bin/env node
// Standalone integration verification for Stage 4 (SaaS commercial
// layer: demo requests, subscriptions, entitlements) and Stage 5
// (unified Person identity spanning schools) — real HTTP requests via
// supertest, against a real, disposable MongoDB replica set, no
// mocking. Same approach as scripts/verify-tenant-isolation.js (see
// that file's header for why this is a plain Node script, not Jest).
//
// Run: npm run verify:stage-4-5

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
	tel: overrides.tel,
	gender: 'male',
	dob: '1990-01-01',
	matricule: overrides.matricule,
	high_certificate: 'PhD',
	marital_status: 'married',
	...overrides,
});

const validStudentFields = (overrides = {}) => ({
	name: 'Student One',
	matricule: overrides.matricule,
	address: 'Buea',
	gender: 'male',
	dob: '2008-05-12',
	parent_name: 'Parent One',
	parent_tel: '677001122',
	level: 100,
	...overrides,
});

async function main() {
	const mongoHandle = await testMongo.start();
	await mongoose.connect(process.env.DATABASE);

	process.env.JWT_SECRET = 'test-jwt-secret';
	process.env.JWT_SECRET_STUDENT = 'test-jwt-secret-student';
	process.env.JWT_SECRET_PLATFORM = 'test-jwt-secret-platform';
	process.env.JWT_SECRET_PERSON = 'test-jwt-secret-person';
	process.env.JWT_EXPIRES_IN = '1d';
	process.env.COOKIE_EXP = '1';
	process.env.RATE_LIMIT_ATTEMPTS = '2000';
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
	const DemoRequest = require('../models/demo_request.model');
	const Subscription = require('../models/subscription.model');

	try {
		console.log('\n=== Stage 4: demo request -> subscription -> entitlements ===');

		await PlatformStaff.create({
			name: 'Founder',
			email: 'founder@deschool.cm',
			password: 'superSecret123',
			role: 'super_admin',
		});

		const demoRes = await request(app).post('/api/v1/platform/demo-requests').send({
			name: 'Prospective Admin',
			schoolName: 'GTTC Buea',
			contactEmail: 'lead@gttc.cm',
			contactPhone: '677000000',
			cityRegion: 'Buea',
			studentCount: 500,
		});
		assert(demoRes.status === 201, `public demo request submission returns 201 (got ${demoRes.status}, body: ${JSON.stringify(demoRes.body)})`);
		assert(demoRes.body.data.status === 'lead', "new demo request starts at status 'lead'");
		const demoRequestId = demoRes.body.data._id;

		const platformLogin = await request(app).post('/api/v1/platform/login').send({
			email: 'founder@deschool.cm',
			password: 'superSecret123',
		});
		assert(platformLogin.status === 200, `platform login returns 200 (got ${platformLogin.status})`);
		const platformToken = platformLogin.body.data.token;

		const listDemos = await request(app).get(`/api/v1/platform/demo-requests/${platformToken}`);
		assert(listDemos.status === 200, `platform can list demo requests (got ${listDemos.status})`);
		assert(listDemos.body.data.length === 1, `exactly 1 demo request listed (got ${listDemos.body.data.length})`);

		const scheduleRes = await request(app)
			.patch(`/api/v1/platform/demo-requests/${demoRequestId}/${platformToken}`)
			.send({ status: 'demo_scheduled' });
		assert(scheduleRes.status === 200, `demo request status updates to demo_scheduled (got ${scheduleRes.status})`);
		assert(scheduleRes.body.data.status === 'demo_scheduled', 'status field actually changed');

		const schoolRes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'GTTC Buea',
				slug: 'gttc-buea',
				contactEmail: 'contact@gttc.cm',
				firstAdmin: validStaffFields({ email: 'admin@gttc.cm', matricule: 'ADM-001', tel: '677111111' }),
				demoRequestId,
			});
		assert(schoolRes.status === 201, `creating a school linked to the demo request returns 201 (got ${schoolRes.status}, body: ${JSON.stringify(schoolRes.body)})`);
		const schoolId = schoolRes.body.data._id;

		const convertedDemo = await DemoRequest.findById(demoRequestId);
		assert(convertedDemo.status === 'active', "converting a school flips the linked demo request to status 'active'");
		assert(String(convertedDemo.schoolId) === String(schoolId), 'the demo request is linked to the real new schoolId');

		const subscription = await Subscription.findOne({ schoolId });
		assert(Boolean(subscription), 'a Subscription was created automatically alongside the School');
		assert(subscription.plan === 'starter', `default plan is 'starter' (got ${subscription.plan})`);
		assert(subscription.priceXAF === 15000, `starter plan priced at 15000 XAF/month (got ${subscription.priceXAF})`);

		const entitlements = require('../utilities/entitlements');
		const canteenOnStarter = await entitlements.hasEntitlement(schoolId, 'canteen');
		assert(canteenOnStarter === false, 'canteen feature is NOT entitled on the starter plan while subscription is still trialing');

		const upgradeRes = await request(app)
			.patch(`/api/v1/platform/schools/${schoolId}/subscription/${platformToken}`)
			.send({ plan: 'standard', status: 'active' });
		assert(upgradeRes.status === 200, `platform can upgrade a school's subscription (got ${upgradeRes.status})`);

		const canteenOnStandardActive = await entitlements.hasEntitlement(schoolId, 'canteen');
		assert(canteenOnStandardActive === true, 'canteen feature IS entitled once upgraded to standard + active');

		const smsOnStandard = await entitlements.hasEntitlement(schoolId, 'sms_notifications');
		assert(smsOnStandard === false, 'sms_notifications correctly still NOT entitled on standard (premium-only)');

		console.log('\n=== Stage 5: one Person identity spanning two separate schools ===');

		// A second, independent school, to prove cross-school linking for
		// real — not just within one school's own data.
		const schoolBRes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'Teacher Training College',
				slug: 'ttc-buea',
				contactEmail: 'contact@ttc.cm',
				firstAdmin: validStaffFields({ email: 'admin@ttc.cm', matricule: 'ADM-002', tel: '677222222' }),
			});
		assert(schoolBRes.status === 201, `second, unrelated school created (got ${schoolBRes.status})`);

		const adminALogin = await request(app).post('/api/v1/staff/login').send({ email: 'admin@gttc.cm', password: 'password123' });
		const staffTokenA = adminALogin.body.data.token;
		const adminBLogin = await request(app).post('/api/v1/staff/login').send({ email: 'admin@ttc.cm', password: 'password123' });
		const staffTokenB = adminBLogin.body.data.token;
		assert(Boolean(staffTokenA) && Boolean(staffTokenB), 'both schools\' admins can log in');

		// Build the real dependency chain (Program -> Department ->
		// Specialty) each school needs before it can create a Student —
		// reusing each school's own admin as director/deputyDirector/hod,
		// same as a real bootstrap would for its very first records.
		async function buildSpecialty(staffToken, adminStaffId, suffix) {
			const program = await request(app)
				.post(`/api/v1/program/${staffToken}`)
				.send({ name: `Program ${suffix}`, director: adminStaffId, deputyDirector: adminStaffId });
			const department = await request(app)
				.post(`/api/v1/department/${staffToken}`)
				.send({ name: `Department ${suffix}`, hod: adminStaffId, program: program.body.data._id });
			const specialty = await request(app)
				.post(`/api/v1/specialty/${staffToken}`)
				.send({ name: `Specialty ${suffix}`, department: department.body.data._id, level: 100 });
			return specialty.body.data._id;
		}

		const Staff = require('../models/staff.model');
		const staffA = await Staff.findOne({ email: 'admin@gttc.cm' }).setOptions({ skipTenantScope: true });
		const staffB = await Staff.findOne({ email: 'admin@ttc.cm' }).setOptions({ skipTenantScope: true });

		const specialtyA = await buildSpecialty(staffTokenA, staffA._id, 'A');
		const specialtyB = await buildSpecialty(staffTokenB, staffB._id, 'B');
		assert(Boolean(specialtyA) && Boolean(specialtyB), 'both schools independently built a full Program -> Department -> Specialty chain');

		const academicYearARes = await request(app)
			.post(`/api/v1/academic-year/${staffTokenA}`)
			.send({ academicYear: '2024/2025' });
		const academicYearBRes = await request(app)
			.post(`/api/v1/academic-year/${staffTokenB}`)
			.send({ academicYear: '2024/2025' }); // same string as School A's, deliberately (Stage 3's compound index)
		assert(
			academicYearARes.status === 201 && academicYearBRes.status === 201,
			`both schools create an academic year (got ${academicYearARes.status}/${academicYearBRes.status})`
		);
		const academicYearAId = academicYearARes.body.data._id;
		const academicYearBId = academicYearBRes.body.data._id;

		const studentARes = await request(app)
			.post(`/api/v1/student/academic-year/${academicYearAId}/${staffTokenA}`)
			.send(validStudentFields({ matricule: 'STU-001', specialty: specialtyA }));
		assert(studentARes.status === 201, `School A creates a real student (got ${studentARes.status}, body: ${JSON.stringify(studentARes.body)})`);
		const studentAId = studentARes.body.data._id;
		const studentADob = studentARes.body.data.dob;

		const studentBRes = await request(app)
			.post(`/api/v1/student/academic-year/${academicYearBId}/${staffTokenB}`)
			.send(validStudentFields({ matricule: 'STU-001', specialty: specialtyB })); // same matricule as School A's student, deliberately
		assert(studentBRes.status === 201, `School B creates a student with the SAME matricule as School A's (proving Stage 3's compound index still works) (got ${studentBRes.status})`);
		const studentBId = studentBRes.body.data._id;

		const personSignup = await request(app).post('/api/v1/person/signup').send({
			name: 'Real Student',
			email: 'student@example.cm',
			password: 'password123',
			confirmPassword: 'password123',
		});
		assert(personSignup.status === 201, `Person self-service signup returns 201 (got ${personSignup.status}, body: ${JSON.stringify(personSignup.body)})`);

		const personLogin = await request(app).post('/api/v1/person/login').send({ email: 'student@example.cm', password: 'password123' });
		assert(personLogin.status === 200, `Person login returns 200 (got ${personLogin.status})`);
		const personToken = personLogin.body.data.token;

		const linkWrongDob = await request(app)
			.post(`/api/v1/person/link-enrollment/${personToken}`)
			.send({ schoolSlug: 'gttc-buea', matricule: 'STU-001', dob: '2000-01-01' });
		assert(linkWrongDob.status === 404, `linking with a wrong dob is rejected (got ${linkWrongDob.status}, body: ${JSON.stringify(linkWrongDob.body)})`);

		const linkA = await request(app)
			.post(`/api/v1/person/link-enrollment/${personToken}`)
			.send({ schoolSlug: 'gttc-buea', matricule: 'STU-001', dob: studentADob });
		assert(linkA.status === 200, `linking School A's enrollment with the correct dob succeeds (got ${linkA.status}, body: ${JSON.stringify(linkA.body)})`);

		const linkB = await request(app)
			.post(`/api/v1/person/link-enrollment/${personToken}`)
			.send({ schoolSlug: 'ttc-buea', matricule: 'STU-001', dob: studentBDobOf(studentBRes) });
		assert(linkB.status === 200, `the SAME person links a DIFFERENT school's enrollment too (got ${linkB.status}, body: ${JSON.stringify(linkB.body)})`);

		const otherPersonSignup = await request(app).post('/api/v1/person/signup').send({
			name: 'Someone Else',
			email: 'someone-else@example.cm',
			password: 'password123',
			confirmPassword: 'password123',
		});
		const otherPersonLogin = await request(app).post('/api/v1/person/login').send({ email: 'someone-else@example.cm', password: 'password123' });
		const otherPersonToken = otherPersonLogin.body.data.token;
		const stealAttempt = await request(app)
			.post(`/api/v1/person/link-enrollment/${otherPersonToken}`)
			.send({ schoolSlug: 'gttc-buea', matricule: 'STU-001', dob: studentADob });
		assert(stealAttempt.status === 409, `a second, different Person cannot also link an already-claimed enrollment (got ${stealAttempt.status})`);

		const enrollments = await request(app).get(`/api/v1/person/enrollments/${personToken}`);
		assert(enrollments.status === 200, `Person can list their own enrollments (got ${enrollments.status})`);
		assert(enrollments.body.data.length === 2, `exactly 2 enrollments listed, across 2 different schools (got ${enrollments.body.data.length})`);
		const schoolNames = enrollments.body.data.map((e) => e.schoolId.name).sort();
		assert(
			schoolNames[0] === 'GTTC Buea' && schoolNames[1] === 'Teacher Training College',
			`both real school names are populated on the enrollment list (got ${JSON.stringify(schoolNames)})`
		);

		const switchRes = await request(app).post(`/api/v1/person/enrollments/${studentAId}/switch/${personToken}`);
		assert(switchRes.status === 200, `switching to School A's enrollment returns 200 (got ${switchRes.status})`);
		const studentJwt = switchRes.body.data.token;
		assert(Boolean(studentJwt), 'switching returns a real student token');

		// The whole point of Stage 5's design: this token now works against
		// the EXISTING, completely unmodified student-scoped route surface
		// (routes/mobile/mobile.student.routes.js) — no new API had to be
		// built for the mobile app to keep working.
		const timetableRes = await request(app).post(`/api/v1/student-app/timetables/${studentJwt}`).send({});
		assert(timetableRes.status === 200, `the minted student token works against the pre-existing, unmodified mobile student route (got ${timetableRes.status}, body: ${JSON.stringify(timetableRes.body)})`);

		const switchToOthersEnrollment = await request(app).post(`/api/v1/person/enrollments/${studentBId}/switch/${otherPersonToken}`);
		assert(switchToOthersEnrollment.status === 403, `a different Person cannot switch into an enrollment they never linked (got ${switchToOthersEnrollment.status})`);

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

function studentBDobOf(studentBRes) {
	return studentBRes.body.data.dob;
}

main();
