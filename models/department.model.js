const mongoose = require('mongoose');

//A program can belong to more than one department, possibly
const departmentSchema = new mongoose.Schema({
	name: {
		type: String,
		unique: true,
		required: [true, 'A department must have a name'],
	},
	hod: {
		type: mongoose.Types.ObjectId,
		ref: 'staff',
		required: [true, 'Each department must have a HEAD (HOD)'],
	},
	program: {
		type: mongoose.Types.ObjectId,
		ref: 'program',
		required: [true, 'A department must belong to a school'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

departmentSchema.pre(/^find/, function (next) {
	this.populate('hod', 'name').populate('program', 'name');

	next();
});

const Department = mongoose.model('department', departmentSchema);
module.exports = Department;
