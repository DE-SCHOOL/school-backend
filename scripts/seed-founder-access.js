#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const PlatformStaff = require('../models/platform_staff.model');
const School = require('../models/school.model');
const Staff = require('../models/staff.model');
const tenantContext = require('../utilities/tenantContext');

// One-time dev bootstrap, run manually, never exposed as an HTTP
// endpoint (see verify-tenant-isolation.js's own comment on why
// platform-super-admin creation deliberately has no self-service route).
// Creates exactly two accounts to actually log into the app with:
//  1. A platform super_admin (for the new platform console).
//  2. A school-admin in the already-migrated LMU school (Stage 9), since
//     that school's real staff passwords are real production bcrypt
//     hashes this script has no plaintext for.
// Idempotent — safe to re-run; updates the password on an existing
// account rather than erroring, so credentials are always exactly what
// this script prints, not whatever they drifted to.
//
// Usage: node scripts/seed-founder-access.js

const PLATFORM_EMAIL = 'founder@deschool.cm';
const PLATFORM_PASSWORD = 'DevPlatform#2026';

const SCHOOL_ADMIN_EMAIL = 'devadmin@landmark.cm';
const SCHOOL_ADMIN_PASSWORD = 'DevAdmin#2026';

async function main() {
	if (!process.env.DATABASE) throw new Error('DATABASE env var is not set (see .env).');
	await mongoose.connect(process.env.DATABASE);

	try {
		let platformStaff = await PlatformStaff.findOne({ email: PLATFORM_EMAIL });
		if (platformStaff) {
			platformStaff.password = PLATFORM_PASSWORD;
			await platformStaff.save();
			console.log(`[seed] updated existing platform super_admin ${PLATFORM_EMAIL}`);
		} else {
			await PlatformStaff.create({
				name: 'Founder',
				email: PLATFORM_EMAIL,
				password: PLATFORM_PASSWORD,
				role: 'super_admin',
			});
			console.log(`[seed] created platform super_admin ${PLATFORM_EMAIL}`);
		}

		const school = await School.findOne({ slug: 'lmu' });
		if (!school) {
			throw new Error('No school with slug "lmu" found — run `npm run migrate:existing-school` first.');
		}

		await tenantContext.run({ schoolId: school._id }, async () => {
			let schoolAdmin = await Staff.findOne({ email: SCHOOL_ADMIN_EMAIL }).setOptions({ skipTenantScope: true });
			if (schoolAdmin) {
				schoolAdmin.password = SCHOOL_ADMIN_PASSWORD;
				schoolAdmin.confirmPassword = SCHOOL_ADMIN_PASSWORD;
				await schoolAdmin.save();
				console.log(`[seed] updated existing school admin ${SCHOOL_ADMIN_EMAIL} (${school.name})`);
			} else {
				await Staff.create({
					name: 'Dev Admin',
					matricule: 'DEV-ADMIN-001',
					email: SCHOOL_ADMIN_EMAIL,
					password: SCHOOL_ADMIN_PASSWORD,
					confirmPassword: SCHOOL_ADMIN_PASSWORD,
					tel: 670000001,
					gender: 'male',
					dob: new Date('1990-01-01'),
					pob: 'Buea',
					role: 'admin',
					high_certificate: 'N/A',
					marital_status: 'not married',
				});
				console.log(`[seed] created school admin ${SCHOOL_ADMIN_EMAIL} (${school.name})`);
			}
		});

		console.log('\n=== Dev login credentials — for local/staging use only, rotate before any real launch ===');
		console.log(`Platform console (super_admin): ${PLATFORM_EMAIL} / ${PLATFORM_PASSWORD}`);
		console.log(`School staff login (admin, ${school.name}): ${SCHOOL_ADMIN_EMAIL} / ${SCHOOL_ADMIN_PASSWORD}`);
	} finally {
		await mongoose.disconnect();
	}
}

main().catch((err) => {
	console.error('[seed] FAILED:', err.message);
	process.exit(1);
});
