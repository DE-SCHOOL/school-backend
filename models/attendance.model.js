const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

const attendanceSchema = new mongoose.Schema({
	attendance: [
		{
			date: { type: Date },
			wasPresentMorning: { type: Boolean },
			wasPresentEvening: { type: Boolean },
			wasPresent: { event: String, isPresent: Boolean },
		},
	],
	student: {
		type: mongoose.Types.ObjectId,
		required: [true, 'Attendance must involve a student'],
		ref: 'student',
		unique: true,
	},
	// staff: {
	// 	type: mongoose.Types.ObjectId,
	// 	required: [true, 'Attendance must be recorded by a teacher'],
	// 	ref: 'staff',
	// },
});

attendanceSchema.plugin(tenantScope);

attendanceSchema.pre(/^find/, function () {
	// Was also `.populate('teacher', 'name')` — 'teacher' isn't a field on
	// this schema (the commented-out field above is 'staff'), so that call
	// silently populated nothing. Removed rather than guessed at reviving.
	this.populate({ path: 'student', select: 'name level matricule' });
});

const Attendance = mongoose.model('attendance', attendanceSchema);

module.exports = Attendance;
