const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
	attendance: [
		{
			date: { type: Date, default: new Date() },
			wasPresentMorning: { type: Boolean },
			wasPresentEvening: { type: Boolean },
			// wasPresent: { type: {Boolean}, default: false },
			wasPresent: { event: String, isPresent: Boolean },
		},
	],
	student: {
		type: mongoose.Types.ObjectId,
		required: [true, 'Attendance must involve a student'],
		ref: 'student',
	},
	staff: {
		type: mongoose.Types.ObjectId,
		required: [true, 'Attendance must be recorded by a teacher'],
		ref: 'staff',
	},
});

attendanceSchema.pre(/^find/, function (next) {
	this.populate({ path: 'student', select: 'name level matricule' }).populate(
		'teacher',
		'name'
	);

	next();
});

const Attendance = mongoose.model('attendance', attendanceSchema);
