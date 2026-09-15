#!/usr/bin/env node
// Verifies scripts/migrate-existing-school.js's output through the real
// application — Mongoose models (tenant scoping, populate) and the real
// HTTP auth pipeline — not just "the insert didn't throw." Runs against
// whatever DATABASE already points at (the same local staging DB the
// migration just wrote to); deliberately does NOT drop/reset it
// afterwards, unlike the other verify:* scripts, since this DB holds a
// real school's data meant to persist for continued local dev.

require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const tenantContext = require('../utilities/tenantContext');

let passed = 0;
function assert(condition, message) {
	if (!condition) throw new Error(`FAILED: ${message}`);
	passed++;
	console.log(`  ok: ${message}`);
}

// staff is intentionally excluded from EXPECTED_COUNTS below and
// checked separately as a minimum, not an exact count: real usage
// legitimately adds staff over time (scripts/seed-founder-access.js's
// dev admin, or the school actually hiring people), so an exact-match
// assertion here would start failing forever the moment anyone did
// anything with this data after the migration — the point of this
// check is "did every real migrated record survive", not "is the
// database frozen exactly as the migration left it".
const MINIMUM_STAFF_COUNT = 7;

const EXPECTED_COUNTS = {
	academic_year: 4,
	department: 20,
	program: 7,
	specialty: 36,
	course: 639,
	student: 1326,
	form_b: 1,
	mark: 25552,
	question_category: 1,
	question: 13,
	review: 0,
	staff_course: 9,
	student_academic_year: 1386,
	timetable: 0,
};


async function main() {
	if (!process.env.DATABASE) {
		throw new Error('DATABASE env var is not set — this verifies the DB the migration script just wrote to.');
	}
	await mongoose.connect(process.env.DATABASE);

	process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-stage-9-secret';
	process.env.JWT_SECRET_STUDENT = process.env.JWT_SECRET_STUDENT || 'verify-stage-9-secret-student';
	process.env.JWT_SECRET_PLATFORM = process.env.JWT_SECRET_PLATFORM || 'verify-stage-9-secret-platform';
	process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
	process.env.COOKIE_EXP = process.env.COOKIE_EXP || '1';
	process.env.RATE_LIMIT_ATTEMPTS = process.env.RATE_LIMIT_ATTEMPTS || '1000';
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
	const School = require('../models/school.model');
	const Subscription = require('../models/subscription.model');
	const Student = require('../models/students.model');
	const Staff = require('../models/staff.model');
	const Department = require('../models/department.model');
	const Program = require('../models/programs.model');
	const StaffCourse = require('../models/staff_courses.model');
	const Mark = require('../models/marks.model');

	try {
		console.log('\n1. The migrated school exists');
		const school = await School.findOne({ slug: 'lmu' });
		assert(Boolean(school), 'school with slug "lmu" exists');
		assert(school.name === 'Landmark Metropolitan University', 'school name is correct');
		assert(school.status === 'active', 'school status is active');

		console.log('\n2. It has a subscription');
		const sub = await Subscription.findOne({ schoolId: school._id });
		assert(Boolean(sub), 'subscription exists for the migrated school');
		assert(sub.status === 'active', 'subscription status is active');

		console.log('\n3. Every imported collection is readable, tenant-scoped, with the exact expected count');
		await tenantContext.run({ schoolId: school._id }, async () => {
			for (const [modelName, expected] of Object.entries(EXPECTED_COUNTS)) {
				const Model = mongoose.model(modelName);
				const count = await Model.countDocuments();
				assert(count === expected, `${modelName}: expected ${expected}, got ${count}`);
			}
			const staffCount = await Staff.countDocuments();
			assert(
				staffCount >= MINIMUM_STAFF_COUNT,
				`staff: at least the ${MINIMUM_STAFF_COUNT} real migrated staff are present (got ${staffCount})`
			);
		});

		console.log('\n4. populate() on documents with dangling refs (pre-existing in production) does not crash — resolves to null instead');
		await tenantContext.run({ schoolId: school._id }, async () => {
			const deptsWithBrokenHod = await Department.find({}).setOptions({ skipTenantScope: false });
			assert(deptsWithBrokenHod.length === 20, 'all 20 departments load despite 18 having a dangling hod ref');
			const someNullHod = deptsWithBrokenHod.some((d) => d.hod === null);
			assert(someNullHod, 'at least one department shows hod as null (populate degraded gracefully, did not throw)');

			const programs = await Program.find({});
			assert(programs.length === 7, 'all 7 programs load despite every director/deputyDirector ref being dangling');
			assert(programs.every((p) => p.director === null && p.deputyDirector === null), 'director/deputyDirector are null, not crashes, for every program');

			const staffCourses = await StaffCourse.find({});
			assert(staffCourses.length === 9, 'all 9 staff_courses load despite every staff ref being dangling');
		});

		console.log('\n5. Real cross-referenced data reads correctly (courses <- specialty, students <- specialty, marks <- student/course)');
		await tenantContext.run({ schoolId: school._id }, async () => {
			const sampleStudent = await Student.findOne({ matricule: 'LMU-24SWE231' });
			assert(Boolean(sampleStudent), 'a known real student (LMU-24SWE231) is present');
			assert(sampleStudent.specialty && sampleStudent.specialty.name, `student's specialty populated with a real name (got: ${sampleStudent.specialty && sampleStudent.specialty.name})`);

			const markCount = await Mark.countDocuments({ student: sampleStudent._id });
			assert(markCount > 0, `sample student has real mark records linked (found ${markCount})`);
		});

		console.log('\n6. Tenant isolation still fails closed on this real data (no context => throws, not silently unscoped)');
		let threw = false;
		try {
			await Student.countDocuments();
		} catch (err) {
			threw = err.name === 'TenantScopeError';
		}
		assert(threw, 'Student.countDocuments() with no tenant context throws TenantScopeError');

		console.log('\n7. Scoping actually filters — a different (nonexistent) schoolId context sees zero of this data');
		await tenantContext.run({ schoolId: new mongoose.Types.ObjectId() }, async () => {
			const count = await Student.countDocuments();
			assert(count === 0, `an unrelated schoolId sees 0 of LMU's ${EXPECTED_COUNTS.student} students (got ${count})`);
		});

		console.log('\n8. The real HTTP auth pipeline runs against the migrated staff record without crashing');
		const adminStaff = await Staff.findOne({ email: 'litdirectorate@landmark.cm' }).setOptions({ skipTenantScope: true });
		assert(Boolean(adminStaff), 'migrated admin staff record is findable by its real email');
		assert(adminStaff.role === 'admin', 'migrated admin staff kept its admin role');
		const wrongLogin = await request(app).post('/api/v1/staff/login').send({
			email: 'litdirectorate@landmark.cm',
			password: 'definitely-not-the-real-password',
		});
		assert(wrongLogin.status === 401, `login against the real migrated bcrypt hash rejects a wrong password with 401 (got ${wrongLogin.status})`);

		console.log('\n9. Platform console can see the migrated school (getAllSchools)');
		const PlatformStaff = require('../models/platform_staff.model');
		let platformStaff = await PlatformStaff.findOne({ email: 'verify-stage9-platform@deschool.cm' });
		if (!platformStaff) {
			platformStaff = await PlatformStaff.create({
				name: 'Stage 9 Verifier',
				email: 'verify-stage9-platform@deschool.cm',
				password: 'superSecret123',
				role: 'super_admin',
			});
		}
		const platformLogin = await request(app).post('/api/v1/platform/login').send({
			email: 'verify-stage9-platform@deschool.cm',
			password: 'superSecret123',
		});
		assert(platformLogin.status === 200, `platform login works (got ${platformLogin.status})`);
		const platformToken = platformLogin.body.data.token;
		const schoolsRes = await request(app).get(`/api/v1/platform/schools/${platformToken}`);
		assert(schoolsRes.status === 200, `platform can list schools (got ${schoolsRes.status})`);
		assert(
			schoolsRes.body.data.some((s) => s.slug === 'lmu'),
			'the migrated school appears in the platform school list'
		);
		await PlatformStaff.deleteOne({ _id: platformStaff._id });

		console.log(`\nALL CHECKS PASSED (${passed} assertions)`);
		process.exitCode = 0;
	} catch (err) {
		console.error('\n' + err.message);
		process.exitCode = 1;
	} finally {
		await mongoose.disconnect();
	}
}

main();
