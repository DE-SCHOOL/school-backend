const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

//A program can belong to more than one department, possibly
const departmentSchema = new mongoose.Schema({
	name: {
		type: String,
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

departmentSchema.plugin(tenantScope);
// Was a lone `unique: true` on name — two different schools can both have
// a "Computer Science" department. Scoped to (schoolId, name).
departmentSchema.index({ schoolId: 1, name: 1 }, { unique: true });

departmentSchema.pre(/^find/, function () {
	this.populate('hod', 'name').populate('program', 'name');
});

const Department = mongoose.model('department', departmentSchema);
module.exports = Department;
