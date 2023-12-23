const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
	course: {
		type: mongoose.Types.ObjectId,
		ref: 'course',
		required: [true, 'Marks must belong to a specific course'],
	},
	student: {
		type: mongoose.Types.ObjectId,
		ref: 'student',
		required: [true, 'Marks must belong to a specific course'],
	},
	s1CA: {
		type: Number,
		min: [0, 'minimum for a CA mark should be 0'],
		max: [30, 'maximum for an Exam mark should be 30'],
		default: 0,
	},
	s1Exam: {
		type: Number,
		min: [0, 'minimum for a CA mark should be 0'],
		max: [70, 'maximum for an Exam mark should be 70'],
		default: 0,
	},
	s2CA: {
		type: Number,
		min: [0, 'minimum for a CA mark should be 0'],
		max: [30, 'maximum for an Exam mark should be 30'],
		default: 0,
	},
	s2Exam: {
		type: Number,
		min: [0, 'minimum for a CA mark should be 0'],
		max: [70, 'maximum for an Exam mark should be 70'],
		default: 0,
	},
	preMock: {
		type: Number,
		min: [0, 'minimum for a CA mark should be 0'],
		max: [100, 'maximum for an Exam mark should be 100'],
		default: 0,
	},
	mock: {
		type: Number,
		min: [0, 'minimum for a CA mark should be 0'],
		max: [100, 'maximum for an Exam mark should be 100'],
		default: 0,
	},
	academicYear: {
		type: String,
		required: [true, 'A mark must belong to an academic year.'],
	},
});

//Setting student as an index without using unique:true in modelSchema definition
// markSchema.index({student: 1}) 1 for ascending order and -1 for descending order

//Setting a composite key combination of student and course ids
markSchema.index({ course: 1, student: 1 }, { unique: true });

markSchema.pre(/^find/, function (next) {
	this.populate('course', 'name code').populate('student', 'name matricule');

	next();
});

const Mark = mongoose.model('mark', markSchema);
module.exports = Mark;
