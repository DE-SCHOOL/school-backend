const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const tenantScope = require('../utilities/tenantScope.plugin');

const staffSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name must be provided'],
	},
	matricule: {
		type: String,
		required: [true, 'Students must have a matricule'],
	},
	email: {
		type: String,
		unique: true,
		required: [true, 'Email address must be provided'],
		validate: [validator.isEmail, 'Invalid email provided'],
	},
	password: {
		type: String,
		minlength: [8, 'password should be atleast 8 characters'],
		required: [true, 'passwords are required'],
		select: false,
	},
	confirmPassword: {
		type: String,
		required: [true, 'passwords are required'],
		validate: {
			validator: function (val) {
				return this.password === val;
			},
			message: 'Passwords do not match, please verify',
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
	picture: {
		type: String,
		default: 'n/a',
	},
	tel: {
		type: Number,
		unique: true,
		required: [true, 'Staff must have a valide phone number'],
		validate: {
			validator: (val) => {
				const valid = `${val}`.startsWith('6') && `${val}`.length === 9;
				return valid;
			},
			message:
				'Phone number does not start with 6, or is not upto 9 characters',
		},
	},
	gender: {
		type: String,
		required: [true, 'Gender is required'],
		enum: {
			values: ['male', 'female'],
			message: 'Gender is either male or female',
		},
	},
	address: String,
	createdAt: {
		type: Date,
		default: Date.now(),
	},
	role: {
		type: String,
		// default: 'lecturer',
		required: [true, 'Each staff must have a role'],
		enum: {
			values: ['lecturer', 'secreteriat', 'hod', 'director', 'admin'],
			message: 'A user must either be a lecturer, hod, admin or lecturer',
		},
	},
	high_certificate: {
		type: String,
		required: [
			true,
			'A staff must have a highest certificate obtained to show.',
		],
	},
	marital_status: {
		type: String,
		required: [true, 'Information must be provided'],
		enum: {
			values: ['married', 'not married', 'seperated', 'devorced'],
			message:
				"Marital status can either be 'married', 'not married', 'seperated' or 'devorced'.",
		},
	},
	isHidden: {
		type: Boolean,
		default: false,
	},
});

staffSchema.plugin(tenantScope);
// Was a lone `unique: true` on matricule — two different schools can
// legitimately reuse the same matricule numbering scheme. Scoped to
// (schoolId, matricule). email/tel stay globally unique on purpose:
// email is the cross-school login lookup key (auth.controller.js's
// login searches by email alone, before any school is known), and a
// real phone number is inherently globally unique regardless of tenant.
staffSchema.index({ schoolId: 1, matricule: 1 }, { unique: true });

staffSchema.pre('save', async function () {
	// Mongoose 9 changed callback-style document middleware — a
	// function(next) no longer receives a real callback (it's called with
	// no usable argument), so `next()` silently threw "next is not a
	// function" and this hook never actually ran. Promise-style (no
	// `next` param, throw to fail) is the fix, and is now Mongoose's
	// primary supported style anyway.
	if (this.isNew || this.isModified('password')) {
		const saltRounds = 12;
		const hash = await bcrypt.hash(this.password, saltRounds);
		this.password = hash;
		this.confirmPassword = undefined;
	}
});

staffSchema.pre(/^find/, function () {
	this.select('-__v');
	// this.populate('department', 'name');
	// this.populate({ path: 'department' });
});

staffSchema.methods.isPasswordCorrect = async (hash, plainPassword) => {
	const isCorrect = await bcrypt.compare(plainPassword, hash);

	return isCorrect;
};

const Staff = mongoose.model('staff', staffSchema);
module.exports = Staff;
