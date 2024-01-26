const mongoose = require('mongoose');

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
	this.populate('course', 'name code credit_value status').populate(
		'student',
		'name matricule level'
	);

	next();
});

//Defining virtual fields to calculate the credit earned, total marks, grade point, wighted point, grade and GPA
markSchema.virtual('s1Total').get(function () {
	return this.s1CA + this.s1Exam;
});
markSchema.virtual('s2Total').get(function () {
	return this.s2CA + this.s2Exam;
});

//credit earned
markSchema.virtual('s1CreditEarned').get(function () {
	// console.log(this.s1Total, this.course.credit_value);
	if (this.s1Total >= 50) return this.course.credit_value;

	return 0;
});
markSchema.virtual('s2CreditEarned').get(function () {
	// console.log(this.s1Total, this.course.credit_value);
	if (this.s2Total >= 50) return this.course.credit_value;

	return 0;
});

//Grade point
markSchema.virtual('s1GradePoint').get(function () {
	if (this.s1Total >= 80) {
		return 4;
	} else if (this.s1Total >= 70 && this.s1Total < 80) {
		return 3.5;
	} else if (this.s1Total >= 60 && this.s1Total < 70) {
		return 3;
	} else if (this.s1Total >= 55 && this.s1Total < 60) {
		return 2.5;
	} else if (this.s1Total >= 50 && this.s1Total < 55) {
		return 2;
	} else if (this.s1Total >= 40 && this.s1Total < 50) {
		return 1;
	} else if (this.s1Total < 40) {
		return 0;
	}
});
markSchema.virtual('s2GradePoint').get(function () {
	if (this.s2Total >= 80) {
		return 4;
	} else if (this.s2Total >= 70 && this.s2Total < 80) {
		return 3.5;
	} else if (this.s2Total >= 60 && this.s2Total < 70) {
		return 3;
	} else if (this.s2Total >= 55 && this.s2Total < 60) {
		return 2.5;
	} else if (this.s2Total >= 50 && this.s2Total < 55) {
		return 2;
	} else if (this.s2Total >= 40 && this.s2Total < 50) {
		return 1;
	} else if (this.s2Total < 40) {
		return 0;
	}
});

//Grade
markSchema.virtual('s1Grade').get(function () {
	if (this.s1Total >= 80) {
		return 'A';
	} else if (this.s1Total >= 70 && this.s1Total < 80) {
		return 'B+';
	} else if (this.s1Total >= 60 && this.s1Total < 70) {
		return 'B';
	} else if (this.s1Total >= 55 && this.s1Total < 60) {
		return 'C+';
	} else if (this.s1Total >= 50 && this.s1Total < 55) {
		return 'C';
	} else if (this.s1Total >= 40 && this.s1Total < 50) {
		return 'D';
	} else if (this.s1Total < 40) {
		return 'F';
	}
});
markSchema.virtual('s2Grade').get(function () {
	if (this.s2Total >= 80) {
		return 'A';
	} else if (this.s2Total >= 70 && this.s2Total < 80) {
		return 'B+';
	} else if (this.s2Total >= 60 && this.s2Total < 70) {
		return 'B';
	} else if (this.s2Total >= 55 && this.s2Total < 60) {
		return 'C+';
	} else if (this.s2Total >= 50 && this.s2Total < 55) {
		return 'C';
	} else if (this.s2Total >= 40 && this.s2Total < 50) {
		return 'D';
	} else if (this.s2Total < 40) {
		return 'F';
	}
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
