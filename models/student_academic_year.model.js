const mongoose = require('mongoose');

const studentAcademicYearSchema = new mongoose.Schema({
	student: {
		type: mongoose.Types.ObjectId,
		ref: 'student',
		required: [true, 'Student academic year must have student ID'],
	},
	academicYear: {
		type: mongoose.Types.ObjectId,
		ref: 'academic_year',
		required: [true, 'Student academic year must have academic year ID'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

studentAcademicYearSchema.index(
	{ student: 1, academicYear: 1 },
	{ unique: true }
);

const StudentAcademicYear = mongoose.model(
	'student_academic_year',
	studentAcademicYearSchema
);

module.exports = StudentAcademicYear;
