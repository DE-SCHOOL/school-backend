const sendResponse = require('../../utilities/sendResponse');
const StaffCourse = require('./../../models/staff_courses.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.assignStaffCourse = catchAsync(async (req, res, next) => {
	const { courses, staff } = req.body;
	if (!courses || courses?.length === 0)
		return next(
			new ErrorApi('a course or more must be assigned to a lecturer', 400)
		);

	const staffCourse = await StaffCourse.create({ courses, staff });

	sendResponse(res, 'success', 201, staffCourse);
});

exports.getStaffCourse = catchAsync(async (req, res, next) => {
	const staffCourses = await StaffCourse.find({});

	sendResponse(res, 'success', 200, staffCourses);
});

exports.getMyCourses = catchAsync(async (req, res, next) => {
	const staff = req.params.teacherID;
	const course = await StaffCourse.find({ staff });

	const courses = course[0].courses;
	// +semester +credit_value +status
	console.log(courses);
	sendResponse(res, 'success', 200, courses);
});
