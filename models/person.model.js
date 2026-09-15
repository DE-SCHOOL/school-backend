const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

// The platform-level student identity Stage 5 exists to add — one
// login, usable across every school a student is enrolled in. Not
// tenant-scoped (no schoolId — a Person belongs to no single school by
// design).
//
// Deliberately NOT a full Student/Enrollment schema split. The original
// Stage 5 plan considered splitting students.model.js itself into a
// thin Person + a per-school Enrollment carrying matricule/specialty/
// level/etc. — a genuine, invasive schema rewrite touching every
// student-related collection and route. What's built instead is
// additive: Person is a thin identity/auth layer, and students.model.js
// (matricule, specialty, level, parent info, all of it) is completely
// unchanged except for one new optional `personId` field linking it to
// its owner. This is lower-risk (nothing about the existing Student
// shape changes, so the real mobile app — not in this repo — needs zero
// changes), reversible, and still delivers Stage 5's actual goal: see
// controllers/person/person.controller.js's switchEnrollment, which
// mints an ordinary per-student JWT (identical to what
// auth.student.controller.js already issues) for whichever school
// enrollment the Person picks, so every existing student-scoped route
// keeps working completely unmodified.
const personSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name is required'],
	},
	email: {
		type: String,
		required: [true, 'Email is required'],
		unique: true,
		validate: [validator.isEmail, 'Invalid email'],
	},
	phone: {
		type: String,
	},
	password: {
		type: String,
		minlength: [8, 'Password should be at least 8 characters'],
		required: [true, 'Password is required'],
		select: false,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

personSchema.pre('save', async function () {
	if (this.isNew || this.isModified('password')) {
		this.password = await bcrypt.hash(this.password, 12);
	}
});

personSchema.methods.isPasswordCorrect = async function (plainPassword) {
	return bcrypt.compare(plainPassword, this.password);
};

const Person = mongoose.model('person', personSchema);
module.exports = Person;
