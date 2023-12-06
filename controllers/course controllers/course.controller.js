const Course = require('./../../models/courses.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');

exports.createCourse = catchAsync(async (req, res, next) => {
	const { name, specialty, code, semester, levels, credit_value, status } =
		req.body;

	if (!specialty || specialty?.length === 0)
		return next(
			new ErrorApi('A course must be assigned to atleast a specialty', 400)
		);
	if (!levels || levels?.length === 0)
		return next(
			new ErrorApi('A course must be assigned to atleast a level', 400)
		);

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

exports.getCoursesPerSpecialty = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	let courses = await Course.find({ specialty: [`${id}`] });

	if (!courses) courses = [];

	sendResponse(res, 'success', 200, courses);
});
