const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const tenantScope = require('../utilities/tenantScope.plugin');

const studentSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name must be provided'],
	},
	matricule: {
		type: String,
		required: [true, 'Students must have a matricule'],
	},
	specialty: {
		type: mongoose.Types.ObjectId,
		ref: 'specialty',
		required: [true, 'Students must belong to a specialty'],
	},
	address: String,
	gender: {
		type: String,
		required: true,
		enum: {
			values: ['female', 'male'],
			message: 'Gender must either be female or male',
		},
	},
	dob: {
		type: Date,
		required: [true, 'Student must have a date of birth'],
		validate: [validator.isDate, 'Date must be yyyy/mm/dd'], //Check this after
	},
	pob: {
		type: String,
	},
	email: {
		type: String,
		// unique: true,
		// required: [true, 'student email address must be provided'],
		// validate: [validator.isEmail, 'Invalid student email address'],
	},
	tel: {
		type: Number,
		// unique: true,
		// default: 600000000,
		// required: [true, 'Student must have a phone number'],
		// validate: {
		// 	validator: (val) => {
		// 		const isValid = `${val}`.startsWith('6') && `${val}`.length === 9;
		// 		return isValid;
		// 	},
		// 	message: 'Invalid Phone number for student',
		// },
	},
	password: {
		type: String,
		default: null,
		validate: {
			validator: (val) => val?.length >= 8 || val === null,
			message: 'Password must be at least 8 characters',
		},
		select: false,
	},
	parent_name: {
		type: String,
		required: [true, 'Parent name must be provided'],
	},
	parent_email: {
		type: String,
		// required: [true, 'parent email address must be provided'],
		// validate: [validator.isEmail, 'Invalid parent email address'],
	},
	parent_tel: {
		type: Number,
		required: [true, 'Parent must have a phone number'],
		validate: {
			validator: (val) => {
				const isValid = `${val}`.startsWith('6') && `${val}`.length === 9;
				return isValid;
			},
			message: 'Invalid Phone number for parent',
		},
	},
	level: {
		type: Number,
		enum: {
			values: [100, 200, 300, 400, 500, 601, 602, 603],
			message: 'A class must either be 100, 200, 300, 400, 500, 601, or 602',
		},
		required: [true, 'A student belongs to a particular class'],
	},
	// entry_certificate: {
	// 	type: String,
	// 	required: [
	// 		true,
	// 		'A student must have an entry level certificate to show to be admitted',
	// 	],
	// },
	picture: {
		type: String,
		default: 'n/a',
	},
	// Stage 5: links this school-owned enrollment record to a
	// platform-level Person identity (models/person.model.js). Nullable
	// and not unique here — a Student is created exactly as before by
	// school staff with no Person involved at all, and gets linked later
	// (or never) via a self-service flow. Not unique on this side because
	// nothing stops it being null for many students simultaneously;
	// person.controller.js's linkEnrollment is what actually prevents one
	// Student being claimed by more than one Person.
	personId: {
		type: mongoose.Types.ObjectId,
		ref: 'person',
		default: null,
		index: true,
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

studentSchema.plugin(tenantScope);
// Was a lone `unique: true` on matricule — two different schools can
// legitimately reuse the same matricule numbering scheme. Scoped to
// (schoolId, matricule).
studentSchema.index({ schoolId: 1, matricule: 1 }, { unique: true });

studentSchema.pre(/^find/, function () {
	// A populate() here triggers its own separate query against
	// `specialty` (also tenant-scoped), which needs its own valid tenant
	// context — one this outer query doesn't have when it was
	// deliberately run with skipTenantScope (student login/signup/
	// protect, and Stage 5's cross-school Person lookups, all query
	// Student before/without any tenant context on purpose). Found as a
	// real, live bug via Stage 5's verification script: any of those
	// calls against a real student threw TenantScopeError from inside
	// this populate, not from the outer query itself. Any other
	// tenant-scoped model whose pre-find hook populates another
	// tenant-scoped ref should follow this same guard if it's ever
	// queried with skipTenantScope too.
	if (!this.getOptions().skipTenantScope) {
		this.populate('specialty', 'name');
	}
});

studentSchema.pre('save', async function () {
	// See staff.model.js's identical comment — Mongoose 9 broke
	// callback-style (next) document middleware; promise-style is correct.
	if (this.isModified('password')) {
		const saltRounds = 12;
		const hash = await bcrypt.hash(this.password, saltRounds);
		this.password = hash;
	}
});

studentSchema.methods.isPasswordCorrect = async function (plainPassword, hash) {
	const isCorrect = await bcrypt.compare(plainPassword, hash);
	return isCorrect;
};

const Student = mongoose.model('student', studentSchema);
module.exports = Student;
