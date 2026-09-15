#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { EJSON } = require('bson');

// Stage 9 (my-todo.md): the one-time import of the real, already-live
// school's data (exported from its original single-tenant database,
// `lmu-test`, as Extended-JSON per collection — see
// `../MongoDB Data/lmu-test.<collection>.json`) into the new
// multi-tenant schema. Concretely: create the one School document that
// becomes this data's tenant, then backfill `schoolId` onto every
// document in every tenant-scoped collection.
//
// Deliberately NOT going through Mongoose/the app's models for the
// inserts themselves. Two real reasons, not just convenience:
//   1. staff.model.js's schema requires `confirmPassword` (a
//      write-only field the app clears after hashing on first save) and
//      re-hashes `password` on every `isNew` document — but this export
//      already contains the real bcrypt hashes from production. Running
//      it through the normal `save()` path would either reject every
//      staff record (missing confirmPassword) or double-hash real
//      passwords and silently break every existing login.
//   2. tenantScope.plugin.js's own comments explicitly carve out this
//      exact situation: "Set doc.$locals.skipTenantScope = true if this
//      is a deliberate, reviewed data migration." This script IS that
//      migration — schoolId is set explicitly on every document before
//      it's written, once, here, under review, not inferred from an
//      ambient request-scoped tenant context that doesn't exist outside
//      a request anyway.
// Correctness is instead proven by scripts/verify-stage-9-migration.js,
// which reads the result back through the real Mongoose models —
// tenant scoping, populate, indexes, and all.
//
// Usage:
//   node scripts/migrate-existing-school.js --dry-run
//   node scripts/migrate-existing-school.js
//   node scripts/migrate-existing-school.js --wipe   (re-run after a previous import into the same target)
//
// Safety: refuses to run against anything that isn't a local mongod
// unless --allow-remote is passed explicitly (Stage 9's own instruction:
// "never migrate against production directly" — this only ever runs
// against a disposable local/staging copy by default).

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WIPE = args.includes('--wipe');
const ALLOW_REMOTE = args.includes('--allow-remote');
const STRICT_REFS = args.includes('--strict-refs');
const dataDirArg = args.find((a) => a.startsWith('--data-dir='));
const DATA_DIR = dataDirArg
	? dataDirArg.split('=').slice(1).join('=')
	: path.join(__dirname, '..', '..', 'MongoDB Data');

const SCHOOL_SLUG = 'lmu';
const SCHOOL_NAME = 'Landmark Metropolitan University';
// Derived from real data (staffs.json admin record's email domain,
// landmark.cm) and the CORS origin already on record in app.js — not
// researched separately. Correctable any time via the platform console's
// school-update endpoint once a founder confirms the real values.
const SCHOOL_CONTACT_EMAIL = 'litdirectorate@landmark.cm';
const SCHOOL_ALLOWED_ORIGINS = ['https://gttcbuea.onrender.com'];
// The real, current letterhead values this school's printed documents
// used before this migration — copied from school-frontend's
// src/utilities/appData.js (schoolHeaderProp), which is being retired in
// favor of reading these same fields from this School document per
// school. Not invented for this migration.
const SCHOOL_LETTERHEAD = {
	poBox: 'P.O Box 318, Buea',
	region: 'South West Region, Cameroon',
	country: 'REPUBLIC OF CAMEROON',
	motto: 'PEACE - WORK - FATHERLAND',
	ministry: 'Ministry of Higher Education',
};

// file (without the `lmu-test.` prefix / `.json` suffix) -> target
// collection name (identical here — these exports use the real
// production collection names already) -> ref fields that must resolve
// within this import set. `many: true` means the field is an array of
// ids. Built directly from every `ref:` in models/*.js for the 15
// collections this export contains.
const COLLECTIONS = [
	{ file: 'academic_years', refs: {} },
	{ file: 'departments', refs: { hod: { target: 'staffs' }, program: { target: 'programs' } } },
	{ file: 'programs', refs: { director: { target: 'staffs' }, deputyDirector: { target: 'staffs' } } },
	{ file: 'staffs', refs: {} },
	{ file: 'specialties', refs: { department: { target: 'departments' } } },
	{ file: 'courses', refs: { specialty: { target: 'specialties', many: true } } },
	{ file: 'students', refs: { specialty: { target: 'specialties' } } },
	{ file: 'form_bs', refs: { specialty: { target: 'specialties' }, academicYear: { target: 'academic_years' } } },
	{ file: 'marks', refs: { course: { target: 'courses' }, student: { target: 'students' } } },
	{ file: 'question_categories', refs: {} },
	{ file: 'questions', refs: { category: { target: 'question_categories' } } },
	{ file: 'reviews', refs: { program: { target: 'programs' }, question: { target: 'questions' }, course: { target: 'courses' } } },
	{ file: 'staff_courses', refs: { courses: { target: 'courses', many: true }, staff: { target: 'staffs' } } },
	{ file: 'student_academic_years', refs: { student: { target: 'students' }, academicYear: { target: 'academic_years' } } },
	{ file: 'timetables', refs: { specialty: { target: 'specialties' }, academicYear: { target: 'academic_years' } } },
];

function loadCollection(fileStem) {
	const filePath = path.join(DATA_DIR, `lmu-test.${fileStem}.json`);
	const raw = fs.readFileSync(filePath, 'utf8');
	return EJSON.parse(raw, { relaxed: false });
}

function getRefValue(doc, field) {
	return field.split('.').reduce((v, k) => (v == null ? v : v[k]), doc);
}

async function main() {
	console.log(`[migrate] data dir: ${DATA_DIR}`);
	console.log(`[migrate] mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}${WIPE ? ' + wipe existing import first' : ''}`);

	const dbUri = process.env.DATABASE;
	if (!dbUri) {
		throw new Error('DATABASE env var is not set (see .env) — this script targets whatever the app itself would connect to.');
	}
	const isRemote = dbUri.includes('mongodb+srv') || !/\/\/(localhost|127\.0\.0\.1)[:/]/.test(dbUri);
	if (isRemote && !ALLOW_REMOTE) {
		throw new Error(
			'DATABASE does not point at a local mongod. Stage 9 requires migrating against a staging copy, never production directly. ' +
				'Pass --allow-remote only if you have deliberately pointed DATABASE at a real staging cluster you intend to migrate into.'
		);
	}

	// 1. Load + parse every export up front — referential checks need the
	// full picture before anything is written.
	const loaded = {};
	for (const { file } of COLLECTIONS) {
		loaded[file] = loadCollection(file);
		console.log(`[migrate] loaded ${file}: ${loaded[file].length} documents`);
	}

	// 2. Duplicate-matricule guard (Stage 9's explicit requirement) —
	// must fail loudly, not silently collide, if violated.
	const matriculeCounts = new Map();
	for (const s of loaded.students) {
		matriculeCounts.set(s.matricule, (matriculeCounts.get(s.matricule) || 0) + 1);
	}
	const dupMatricules = [...matriculeCounts.entries()].filter(([, n]) => n > 1);
	if (dupMatricules.length) {
		throw new Error(`Duplicate matricules found within the single school being imported: ${JSON.stringify(dupMatricules)}`);
	}
	console.log(`[migrate] matricule uniqueness OK (${loaded.students.length} students, 0 duplicates)`);

	// 3. Referential integrity — check every ref field against the ids
	// present in this same import set. NOT treated as fatal by default:
	// this export's staffs.json (7 current staff) is only a snapshot —
	// departments/programs still reference historical hod/director staff
	// who've since left and aren't in that snapshot, and a small fraction
	// of marks reference courses/students later deleted from production.
	// Those dangling refs already exist live in production today; this
	// migration's job is to faithfully preserve what's there, not
	// silently decide to drop or "fix" it. Mongoose's populate() returns
	// null for an unresolvable ref rather than throwing, so this doesn't
	// break the app — it reproduces exactly the app's current live
	// behavior for these same records. Pass --strict-refs to hard-fail
	// on this instead, if a clean re-export is ever produced.
	const idSets = {};
	for (const { file } of COLLECTIONS) {
		idSets[file] = new Set(loaded[file].map((d) => d._id.toHexString()));
	}
	const refErrors = [];
	const refErrorsByField = {};
	for (const { file, refs } of COLLECTIONS) {
		for (const doc of loaded[file]) {
			for (const [field, { target, many }] of Object.entries(refs)) {
				const raw = getRefValue(doc, field);
				if (raw == null) continue;
				const values = many ? raw : [raw];
				for (const v of values) {
					if (v == null) continue;
					if (!idSets[target].has(v.toHexString())) {
						refErrors.push(`${file}/${doc._id}: ${field} -> ${v} not found in ${target}`);
						const key = `${file}.${field}`;
						refErrorsByField[key] = (refErrorsByField[key] || 0) + 1;
					}
				}
			}
		}
	}
	if (refErrors.length) {
		console.log(`[migrate] WARNING: ${refErrors.length} dangling references found (pre-existing in production data, not introduced by this migration):`);
		console.log('[migrate]   ' + JSON.stringify(refErrorsByField));
		console.log('[migrate]   sample: ' + refErrors.slice(0, 5).join(' | '));
		if (STRICT_REFS) {
			throw new Error('--strict-refs was set: refusing to import with dangling references present.');
		}
		console.log('[migrate] proceeding — these documents will be imported as-is (see comment above for why).');
	} else {
		console.log('[migrate] referential integrity OK — every ref field resolves within the import set');
	}

	if (DRY_RUN) {
		console.log('[migrate] dry run complete — no writes made. Re-run without --dry-run to import for real.');
		return;
	}

	// 4. Connect and write.
	const client = new MongoClient(dbUri);
	await client.connect();
	const db = client.db();

	try {
		const existing = await db.collection('schools').findOne({ slug: SCHOOL_SLUG });
		if (existing) {
			if (!WIPE) {
				throw new Error(
					`A school with slug "${SCHOOL_SLUG}" already exists at _id ${existing._id} — refusing to import a second time. ` +
						'Re-run with --wipe to delete that school and every document previously imported under it, then re-import fresh.'
				);
			}
			console.log(`[migrate] --wipe: removing previous import for school ${existing._id}`);
			for (const { file } of COLLECTIONS) {
				const res = await db.collection(file).deleteMany({ schoolId: existing._id });
				console.log(`[migrate]   deleted ${res.deletedCount} from ${file}`);
			}
			await db.collection('subscriptions').deleteMany({ schoolId: existing._id });
			await db.collection('schools').deleteOne({ _id: existing._id });
		}

		const schoolId = new ObjectId();
		await db.collection('schools').insertOne({
			_id: schoolId,
			name: SCHOOL_NAME,
			slug: SCHOOL_SLUG,
			contactEmail: SCHOOL_CONTACT_EMAIL,
			contactPhone: null,
			address: 'Buea, Cameroon',
			logo: 'n/a',
			themeColor: '#000000',
			allowedOrigins: SCHOOL_ALLOWED_ORIGINS,
			status: 'active',
			...SCHOOL_LETTERHEAD,
			createdAt: new Date(),
		});
		console.log(`[migrate] created school ${SCHOOL_NAME} (${schoolId})`);

		// Placeholder billing terms — real pricing/billing-cycle is a BIZ
		// decision (my-todo.md Stage 4/11 open item), not something this
		// migration should invent with any real authority. 'manual' payment
		// method + 'active' status reflects reality: this school has been
		// paying/operating outside the new subscription system until now.
		await db.collection('subscriptions').insertOne({
			schoolId,
			plan: 'standard',
			billingCycle: 'monthly',
			status: 'active',
			priceXAF: 35000,
			paymentMethod: 'manual',
			currentPeriodStart: new Date(),
			currentPeriodEnd: null,
			onChainSubscriptionId: null,
			createdAt: new Date(),
		});
		console.log('[migrate] created placeholder subscription (standard/monthly/manual) — update via the platform console with real terms');

		for (const { file } of COLLECTIONS) {
			const docs = loaded[file];
			if (!docs.length) {
				console.log(`[migrate] ${file}: 0 documents, skipping`);
				continue;
			}
			const withTenant = docs.map((d) => ({ ...d, schoolId }));
			const result = await db.collection(file).insertMany(withTenant, { ordered: true });
			console.log(`[migrate] ${file}: inserted ${result.insertedCount}/${docs.length}`);
			if (result.insertedCount !== docs.length) {
				throw new Error(`${file}: inserted count mismatch (${result.insertedCount} != ${docs.length})`);
			}
		}

		console.log(`\n[migrate] DONE. schoolId = ${schoolId}`);
		console.log('[migrate] run `npm run verify:stage-9` to verify this import through the real application models.');
	} finally {
		await client.close();
	}
}

main().catch((err) => {
	console.error('[migrate] FAILED:', err.message);
	process.exit(1);
});
