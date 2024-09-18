const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const studentSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name must be provided'],
	},
	matricule: {
		type: String,
		unique: true,
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
		unique: true,
		required: [true, 'student email address must be provided'],
		validate: [validator.isEmail, 'Invalid student email address'],
	},
	tel: {
		type: Number,
		unique: true,
		required: [true, 'Student must have a phone number'],
		validate: {
			validator: (val) => {
				const isValid = `${val}`.startsWith('6') && `${val}`.length === 9;
				return isValid;
			},
			message: 'Invalid Phone number for student',
		},
	},
	password: {
		type: String,
		default: null,
		validate: {
			validator: (val) => val.length >= 8,
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
		required: [true, 'parent email address must be provided'],
		validate: [validator.isEmail, 'Invalid parent email address'],
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
			values: [200, 300, 400, 500, 601, 602, 603],
			message: 'A level must either be 200, 300, 400, 601, or 602',
		},
		required: [true, 'A course is tought in a particular class level'],
	},
	entry_certificate: {
		type: String,
		required: [
			true,
			'A student must have an entry level certificate to show to be admitted',
		],
	},
	picture: {
		type: String,
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

studentSchema.pre(/^find/, function (next) {
	this.populate('specialty', 'name');
	next();
});

studentSchema.pre('save', async function (next) {
	if (this.isModified('password')) {
		const saltRounds = 12;
		const hash = await bcrypt.hash(this.password, saltRounds);
		this.password = hash;
	}

	next();
});

studentSchema.methods.isPasswordCorrect = async function (plainPassword, hash) {
	const isCorrect = await bcrypt.compare(plainPassword, hash);
	return isCorrect;
};

const Student = mongoose.model('student', studentSchema);
module.exports = Student;
