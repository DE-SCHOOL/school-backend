const mongoose = require('mongoose');
const validator = require('validator');

// The tenant itself. Deliberately NOT plugin(tenantScope)'d — a school
// doesn't belong to another school. Every other model in models/ (except
// platform_staff.model.js) does carry schoolId and is scoped against
// this collection's _id.
const schoolSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A school must have a name'],
	},
	slug: {
		type: String,
		required: [true, 'A school must have a URL-safe slug'],
		unique: true,
		lowercase: true,
		trim: true,
		validate: {
			validator: (val) => /^[a-z0-9-]+$/.test(val),
			message: 'Slug must be lowercase letters, numbers, and hyphens only',
		},
	},
	contactEmail: {
		type: String,
		required: [true, 'A school must have a contact email'],
		validate: [validator.isEmail, 'Invalid contact email'],
	},
	contactPhone: {
		type: String,
	},
	address: {
		type: String,
	},
	// Cameroonian institutional-letterhead fields — printed on official
	// documents (mark sheets, transcripts, statistics reports; see
	// school-frontend's src/utilities/appData.js). Previously one
	// hardcoded object (schoolHeaderProp) baked LMU's own details into
	// every tenant's printed documents; now sourced per-school from here.
	// Optional/no restrictive defaults since the exact set of fields a
	// school prints on its letterhead is theirs to decide — `country`
	// defaults to Cameroon since that's this platform's actual market.
	poBox: {
		type: String,
	},
	region: {
		type: String,
	},
	country: {
		type: String,
		default: 'REPUBLIC OF CAMEROON',
	},
	motto: {
		type: String,
	},
	ministry: {
		type: String,
	},
	logo: {
		type: String,
		default: 'n/a',
	},
	themeColor: {
		type: String,
		default: '#000000',
	},
	// Real allowed origins for this school's frontend(s) — app.js's CORS
	// middleware reads this instead of the single hardcoded origin it used
	// to have. A school can have more than one (e.g. a staging + prod URL).
	allowedOrigins: {
		type: [String],
		default: [],
	},
	status: {
		type: String,
		enum: {
			values: ['pending', 'active', 'suspended'],
			message: 'Status must be pending, active, or suspended',
		},
		default: 'pending',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const School = mongoose.model('school', schoolSchema);
module.exports = School;
