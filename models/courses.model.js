const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

const courseSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A course must have a name'],
	},
	specialty: [
		{
			type: mongoose.Types.ObjectId,
			ref: 'specialty',
			required: [true, 'A course must be attributed to atleast one specialty'],
		},
	],
	code: {
		type: String,
		required: [true, 'A course must have a code'],
	},
	semester: {
		type: String,
		default: 'all'
		// enum: {
		// 	values: ['s1', 's2'],
		// 	message: 'A semester must either be s1 or s2',
		// },
		// required: [true, 'A course belongs to a semester'],
	},
	levels: [
		{
			type: Number,
			enum: {
				values: [100, 200, 300, 400, 500, 601, 602],
				message: 'A level must either be 100, 200, 300, 400, 500, 601, or 602',
			},
			required: [true, 'A course is tought in a particular class level'],
		},
	],
	credit_value: {
		type: Number,
		required: [true, 'A course must have a credit value'],
	},
	status: {
		type: String,
		required: [true, 'A course must have a status'],
		enum: {
			values: ['compulsory', 'elective'],
			message: 'A course must either be compulsory or be an elective',
		},
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

courseSchema.plugin(tenantScope);
// Was a lone `unique: true` on code — course codes like "CS101" are
// school-internal and very plausibly reused across different schools.
// Scoped to (schoolId, code).
courseSchema.index({ schoolId: 1, code: 1 }, { unique: true });

courseSchema.pre(/^find/, function () {
	this.populate('specialty');
});

const Course = mongoose.model('course', courseSchema);
module.exports = Course;
