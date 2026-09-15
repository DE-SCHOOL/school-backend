#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const PlatformStaff = require('../models/platform_staff.model');
const School = require('../models/school.model');
const Subscription = require('../models/subscription.model');
const Staff = require('../models/staff.model');
const Program = require('../models/programs.model');
const Department = require('../models/department.model');
const Specialty = require('../models/specialty.model');
const Course = require('../models/courses.model');
const Student = require('../models/students.model');
const tenantContext = require('../utilities/tenantContext');

// The contributor-facing seed: entirely fictional data, no real school's
// information anywhere in it. Distinct from scripts/migrate-existing-school.js
// (the real production data import, which never leaves the founder's own
// machine — see my-todo.md Stage 9) and scripts/seed-founder-access.js
// (which requires that real migrated school to already exist). Anyone
// cloning this repo runs this one instead: it creates its own school
// from nothing, with a handful of fictional students/staff/courses so
// the app isn't empty on first login.
//
// Idempotent — safe to re-run.

const PLATFORM_EMAIL = 'admin@deschool.dev';
const PLATFORM_PASSWORD = 'DevPlatform#2026';

const SCHOOL_SLUG = 'demo-school';
const SCHOOL_ADMIN_EMAIL = 'admin@demo-school.cm';
const SCHOOL_ADMIN_PASSWORD = 'DevAdmin#2026';

async function upsertPlatformStaff() {
	let platformStaff = await PlatformStaff.findOne({ email: PLATFORM_EMAIL });
	if (platformStaff) {
		platformStaff.password = PLATFORM_PASSWORD;
		await platformStaff.save();
		console.log(`[seed] updated existing platform super_admin ${PLATFORM_EMAIL}`);
	} else {
		await PlatformStaff.create({
			name: 'DE-SCHOOL Admin',
			email: PLATFORM_EMAIL,
			password: PLATFORM_PASSWORD,
			role: 'super_admin',
		});
		console.log(`[seed] created platform super_admin ${PLATFORM_EMAIL}`);
	}
}

async function seedSchool() {
	const existing = await School.findOne({ slug: SCHOOL_SLUG });
	if (existing) {
		console.log(`[seed] demo school already exists (${existing._id}), leaving its data as-is`);
		return existing;
	}

	const school = await School.create({
		name: 'DE-SCHOOL Demo Secondary School',
		slug: SCHOOL_SLUG,
		contactEmail: 'contact@demo-school.cm',
		contactPhone: '677000000',
		address: 'Molyko, Buea, South West Region',
		status: 'active',
		poBox: 'P.O Box 1, Buea',
		region: 'South West Region, Cameroon',
		motto: 'Knowledge, Discipline, Excellence',
		ministry: 'Ministry of Secondary Education',
	});

	await Subscription.create({
		schoolId: school._id,
		plan: 'premium',
		billingCycle: 'monthly',
		status: 'active',
		priceXAF: 75000,
		paymentMethod: 'manual',
		currentPeriodStart: new Date(),
	});

	await tenantContext.run({ schoolId: school._id }, async () => {
		const admin = await Staff.create({
			name: 'Demo Admin',
			matricule: 'ADMIN-001',
			email: SCHOOL_ADMIN_EMAIL,
			password: SCHOOL_ADMIN_PASSWORD,
			confirmPassword: SCHOOL_ADMIN_PASSWORD,
			tel: 677000001,
			gender: 'female',
			dob: new Date('1985-06-15'),
			pob: 'Buea',
			role: 'admin',
			high_certificate: 'Master of Education',
			marital_status: 'married',
		});

		const lecturer = await Staff.create({
			name: 'Emmanuel Fru',
			matricule: 'STAFF-002',
			email: 'emmanuel.fru@demo-school.cm',
			password: SCHOOL_ADMIN_PASSWORD,
			confirmPassword: SCHOOL_ADMIN_PASSWORD,
			tel: 677000002,
			gender: 'male',
			dob: new Date('1990-02-20'),
			pob: 'Kumba',
			role: 'lecturer',
			high_certificate: 'Bachelor of Science',
			marital_status: 'not married',
		});

		const program = await Program.create({
			name: 'General Secondary Education',
			director: admin._id,
			deputyDirector: lecturer._id,
		});

		const department = await Department.create({
			name: 'Sciences',
			hod: lecturer._id,
			program: program._id,
		});

		const specialtyOne = await Specialty.create({ name: 'Science', department: department._id, level: 100 });
		const specialtyTwo = await Specialty.create({ name: 'Arts', department: department._id, level: 100 });

		await Course.create({
			name: 'Mathematics',
			code: 'MATH-100',
			specialty: [specialtyOne._id],
			levels: [100],
			credit_value: 4,
			status: 'compulsory',
		});

		const students = [
			{
				name: 'Achu Divine',
				matricule: 'DEMO-24-001',
				gender: 'male',
				dob: new Date('2008-03-10'),
				parent_name: "Achu's Parent",
				parent_tel: 677000010,
				level: 100,
			},
			{
				name: 'Besong Comfort',
				matricule: 'DEMO-24-002',
				gender: 'female',
				dob: new Date('2008-07-22'),
				parent_name: "Besong's Parent",
				parent_tel: 677000011,
				level: 100,
			},
			{
				name: 'Che Nathaniel',
				matricule: 'DEMO-24-003',
				gender: 'male',
				dob: new Date('2007-11-05'),
				parent_name: "Che's Parent",
				parent_tel: 677000012,
				level: 200,
			},
		];

		for (const s of students) {
			await Student.create({ ...s, specialty: specialtyOne._id, address: 'Buea' });
		}
	});

	console.log(`[seed] created demo school "DE-SCHOOL Demo Secondary School" (${school._id}) with 2 staff and 3 students`);
	return school;
}

async function main() {
	if (!process.env.DATABASE) throw new Error('DATABASE env var is not set (see .env).');
	await mongoose.connect(process.env.DATABASE);

	try {
		await upsertPlatformStaff();
		await seedSchool();

		console.log('\n=== Dev login credentials — fictional data, safe to share with contributors ===');
		console.log(`Platform console  (${'/platform/login'.padEnd(16)}): ${PLATFORM_EMAIL} / ${PLATFORM_PASSWORD}`);
		console.log(`School staff login (${'/auth/signin'.padEnd(15)}): ${SCHOOL_ADMIN_EMAIL} / ${SCHOOL_ADMIN_PASSWORD}`);
	} finally {
		await mongoose.disconnect();
	}
}

main().catch((err) => {
	console.error('[seed] FAILED:', err.message);
	process.exit(1);
});
