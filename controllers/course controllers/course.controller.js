const Course = require('./../../models/courses.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');

exports.createCourse = catchAsync(async (req, res, next) => {
	const {
		name,
		specialty,
		code,
		semester,
		levels,
		credit_value,
		status,
	} = req.body;

	const courses = await Course.create({
		name,
		specialty,
		code,
		semester,
		levels,
		credit_value,
		status,
	});

	sendResponse(res, 'success', 201, courses);
});

exports.getAllCourses = catchAsync(async (req, res, next) => {
	const courses = await Course.find({});

	sendResponse(res, 'success', 200, courses);
});
