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
	},
	{
		toJSON: { virtuals: true },
	}
);

//Setting student as an index without using unique:true in modelSchema definition
// markSchema.index({student: 1}) 1 for ascending order and -1 for descending order

//Setting a composite key combination of student and course ids
markSchema.index({ course: 1, student: 1 }, { unique: true });

markSchema.pre(/^find/, function (next) {
	this.populate('course', 'name code credit_value status levels').populate(
		'student',
		'name matricule level gender dob pob'
	);

	next();
});

//Defining virtual fields to calculate the credit earned, total marks, grade point, wighted point, grade and GPA
markSchema.virtual('s1Total').get(function () {
	if (
		this.course?.levels.includes(300) &&
		(this.mock !== 0 || this.preMock !== 0)
	) {
		let mark = this.mock !== 0 ? this.mock : this.preMock;

		this.s1CA = (0.3 * mark).toFixed(2);
		this.s1Exam = (0.7 * mark).toFixed(2);
	}
	return this.s1CA + this.s1Exam;
});
markSchema.virtual('s2Total').get(function () {
	if (
		// this.course?.levels.includes(300) &&
		this.mock !== 0 ||
		this.preMock !== 0
	) {
		let mark = this.mock !== 0 ? this.mock : this.preMock;

		this.s2CA = (0.3 * mark).toFixed(2);
		this.s2Exam = (0.7 * mark).toFixed(2);
	}
	return this.s2CA + this.s2Exam;
});

//credit earned
markSchema.virtual('s1CreditEarned').get(function () {
	// console.log(this.s1Total, this.course.credit_value);
	if (this.s1Total >= 40) return this?.course?.credit_value || 0;

	return 0;
});
markSchema.virtual('s2CreditEarned').get(function () {
	// console.log(this.s1Total, this.course.credit_value);
	if (this.s2Total >= 40) return this?.course?.credit_value || 0;

	return 0;
});

//Grade point
markSchema.virtual('s1GradePoint').get(function () {
	return determineGradePoint(this.s1Total);
});
markSchema.virtual('s2GradePoint').get(function () {
	return determineGradePoint(this.s2Total);
});

//Grade
markSchema.virtual('s1Grade').get(function () {
	return determineGrade(this.s1Total);
});
markSchema.virtual('s2Grade').get(function () {
	return determineGrade(this.s2Total);
});

//Weighted points
markSchema.virtual('s1WeightedPoints').get(function () {
	return this.s1CreditEarned * this.s1GradePoint;
});
markSchema.virtual('s2WeightedPoints').get(function () {
	return this.s2CreditEarned * this.s2GradePoint;
});

const Mark = mongoose.model('mark', markSchema);
module.exports = Mark;
