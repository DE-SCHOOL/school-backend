const mongoose = require('mongoose');

const staffCourseSchema = new mongoose.Schema({
	courses: [
		{
			type: mongoose.Types.ObjectId,
			ref: 'course',
			required: [true, 'A course is assigned to lecturers, it is compulsory'],
		},
	],
	staff: {
		type: mongoose.Types.ObjectId,
		ref: 'staff',
		required: [true, 'A course is assigned to atleast a staff'],
		unique: true,
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

staffCourseSchema.pre(/^find/, function (next) {
	this.populate({
		path: 'courses',
		select: 'name levels code credit_value semester status',
	}).populate({
		path: 'staff',
		select: 'name',
	});

	next();
});

const StaffCourse = mongoose.model('staff_course', staffCourseSchema);
module.exports = StaffCourse;
