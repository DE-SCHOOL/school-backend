const mongoose = require('mongoose');
const determineGrade = require('../utilities/determinGrade');
const determineGradePoint = require('../utilities/determineGradePoint');
const tenantScope = require('../utilities/tenantScope.plugin');

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
		// Continuous assessment, out of 30 — was never declared on this
		// schema even though controllers/marks/mark.controllers.js's
		// updateStudentsMark has always accepted 's1CA'/'s2CA' as a
		// markType and staff-facing forms (MarkTableFormCA.jsx) submit
		// them: Mongoose's default strict mode silently drops unknown
		// paths on findOneAndUpdate, so every CA score entered through the
		// app was quietly discarded. Declaring these fixes that write path
		// and lets s1Total/s2Total below be computed from real data.
		s1CA: {
			type: Number,
			min: [0, 'minimum for a CA mark should be 0'],
			max: [30, 'maximum for a CA mark should be 30'],
			default: 0,
		},
		s2CA: {
			type: Number,
			min: [0, 'minimum for a CA mark should be 0'],
			max: [30, 'maximum for a CA mark should be 30'],
			default: 0,
		},
		// Exam component, out of 70 (CA 30 + Exam 70 = Total 100 — matches
		// the "CA / 30" / "Exam / 70" / "Total / 100" columns every mark
		// table and transcript actually renders, and the real migrated
		// data: e.g. a genuine record with s1Exam: 46). The previous
		// max: 20 validator contradicted both of those and would have
		// rejected any realistic exam score if this document were ever
		// re-saved through Mongoose.
		s1Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [70, 'maximum for an Exam mark should be 70'],
			default: 0,
		},
		s2Exam: {
			type: Number,
			min: [0, 'minimum for an Exam mark should be 0'],
			max: [70, 'maximum for an Exam mark should be 70'],
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

markSchema.plugin(tenantScope);

// markSchema.index({ course: 1, student: 1 }, { unique: true });
markSchema.index({ course: 1, student: 1, academicYear: 1 }, { unique: true });

markSchema.pre(/^find/, function () {
	this.populate('course', 'name code credit_value status levels').populate(
		'student',
		'name matricule level gender dob pob'
	);
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
markSchema.virtual('yearTotal').get(function () {
	return Number(
		(
			(this.s1Exam +
				this.s2Exam +
				this.s3Exam +
				this.s4Exam +
				this.s5Exam +
				this.s6Exam) /
			6
		).toFixed(2)
	);
});

// s1Total/s2Total (CA out of 30 + Exam out of 70 = Total out of 100) and
// everything derived from them (grade, grade point, credit earned,
// weighted points) were referenced by the frontend
// (components/tables/TableResultTranscript.jsx) but never actually
// implemented here — every one of these came back undefined, which
// crashed the transcript page the moment it was ever exercised against
// real data. course.credit_value is guarded: `course` populates to null
// for marks whose course was later deleted (a real, pre-existing
// condition in the migrated data — see Stage 9's own referential-
// integrity report), and this must degrade to 0, not throw.
markSchema.virtual('s1Total').get(function () {
	return Number((this.s1CA + this.s1Exam).toFixed(2));
});
markSchema.virtual('s2Total').get(function () {
	return Number((this.s2CA + this.s2Exam).toFixed(2));
});

markSchema.virtual('s1GradePoint').get(function () {
	return determineGradePoint(this.s1Total);
});
markSchema.virtual('s2GradePoint').get(function () {
	return determineGradePoint(this.s2Total);
});

markSchema.virtual('s1CreditEarned').get(function () {
	const creditValue = this.course?.credit_value || 0;
	return this.s1GradePoint > 0 ? creditValue : 0;
});
markSchema.virtual('s2CreditEarned').get(function () {
	const creditValue = this.course?.credit_value || 0;
	return this.s2GradePoint > 0 ? creditValue : 0;
});

markSchema.virtual('s1WeightedPoints').get(function () {
	const creditValue = this.course?.credit_value || 0;
	return Number((this.s1GradePoint * creditValue).toFixed(2));
});
markSchema.virtual('s2WeightedPoints').get(function () {
	const creditValue = this.course?.credit_value || 0;
	return Number((this.s2GradePoint * creditValue).toFixed(2));
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
