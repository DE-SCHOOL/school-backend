const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const staffSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name must be provided'],
	},
	matricule: {
		type: String,
		unique: true,
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
	department: {
		type: mongoose.Types.ObjectId,
		ref: 'department',
		required: [true, 'A staff must belong to a department'],
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
});

staffSchema.pre('save', async function (next) {
	if (this.isNew || this.isModified('password')) {
		const saltRounds = 12;
		const hash = await bcrypt.hash(this.password, saltRounds);
		this.password = hash;
		this.confirmPassword = undefined;
	}
	next();
});

staffSchema.pre(/^find/, function (next) {
	this.select('-__v');
	this.populate('department', 'name');

	next();
});

staffSchema.methods.isPasswordCorrect = async (hash, plainPassword) => {
	const isCorrect = await bcrypt.compare(plainPassword, hash);

	return isCorrect;
};

const Staff = mongoose.model('staff', staffSchema);
module.exports = Staff;
