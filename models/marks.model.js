const mongoose = require('mongoose');
const determineGrade = require('../utilities/determinGrade');
const determineGradePoint = require('../utilities/determineGradePoint');

const markSchema = new mongoose.Schema(
	{
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
		s1Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [20, 'maximum for an Exam mark should be 20'],
			default: 0,
		},
		s2Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [20, 'maximum for an Exam mark should be 20'],
			default: 0,
		},
		s3Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [20, 'maximum for an Exam mark should be 20'],
			default: 0,
		},
		s4Exam: {
			type: Number,
			min: [0, 'minimum for a Exam mark should be 0'],
			max: [20, 'maximum for an Exam mark should be 20'],
			default: 0,
		},
		s5Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [20, 'maximum for an Exam mark should be 20'],
			default: 0,
		},
		s6Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [20, 'maximum for an Exam mark should be 20'],
			default: 0,
		},
		preMock: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [100, 'maximum for an Exam mark should be 100'],
			default: 0,
		},
		mock: {
			type: Number,
			min: [0, 'minimum for Exam mark should be 0'],
			max: [100, 'maximum for an Exam mark should be 100'],
			default: 0,
		},
		academicYear: {
			type: String,
			required: [true, 'A mark must belong to an academic year.'],
		},
	},
	{
		toJSON: { virtuals: true },
	}
);

// markSchema.index({ course: 1, student: 1 }, { unique: true });
markSchema.index({ course: 1, student: 1, academicYear: 1 }, { unique: true });

markSchema.pre(/^find/, function (next) {
	this.populate('course', 'name code credit_value status levels').populate(
		'student',
		'name matricule level gender dob pob'
	);

	next();
});

//Defining virtual fields to calculate the credit earned, total marks, grade point, wighted point, grade and GPA
markSchema.virtual('t1Total').get(function () {
	return Number(((this.s1Exam + this.s2Exam) / 2).toFixed(2));
});
markSchema.virtual('t2Total').get(function () {
	return Number(((this.s3Exam + this.s4Exam) / 2).toFixed(2));
});
markSchema.virtual('t3Total').get(function () {
	return Number(((this.s5Exam + this.s6Exam) / 2).toFixed(2));
});

//Grade
markSchema.virtual('s1Grade').get(function () {
	return determineGrade(this.s1Total);
});
markSchema.virtual('s2Grade').get(function () {
	return determineGrade(this.s2Total);
});

const Mark = mongoose.model('mark', markSchema);
module.exports = Mark;
