const Course = require('./../../models/courses.model');
// const StaffCourse = require('./../../models/staff_courses.model');
const Mark = require('./../../models/marks.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const { calcStatsPerCourse } = require('../../utilities/controllerFactory');

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

exports.editCourse = catchAsync(async (req, res, next) => {
	const { id } = req.params;
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

	const course = await Course.findByIdAndUpdate(
		id,
		{
			name,
			specialty,
			code,
			semester,
			levels,
			credit_value,
			status,
		},
		{ new: true, runValidators: true }
	);

	sendResponse(res, 'success', 200, course);
});

exports.getAllCourses = catchAsync(async (req, res, next) => {
	const courses = await Course.find({});

	sendResponse(res, 'success', 200, courses);
});

exports.getCourse = catchAsync(async (req, res, next) => {
	const ID = req.params.id;
	const course = await Course.findById(ID);

	sendResponse(res, 'success', 200, course);
});

exports.getCoursesPerSpecialty = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	let courses = await Course.find({ specialty: `${id}` });

	if (!courses) courses = [];

	sendResponse(res, 'success', 200, courses);
});

exports.getCoursesPerSpecialtyPerLevel = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	const { level } = req.body;
	let courses = await Course.find({ specialty: `${id}`, levels: level });

	// console.log(courses);

	if (!courses) courses = [];

	sendResponse(res, 'success', 200, courses);
});

exports.deleteCourse = catchAsync(async (req, res, next) => {
	const id = req.params.id;
	const course = await Course.findByIdAndDelete(id);

	const courses = await Course.find({});

	sendResponse(res, 'success', 200, courses);
});

exports.primaryCourseStatistics = catchAsync(async (req, res, next) => {
	const { courseID } = req.params;
	const { semester, academicYear } = req.body;

	// console.log(courseStats);
	const courseStats = await calcStatsPerCourse(
		courseID,
		semester,
		academicYear,
		Course,
		Mark
	);
	sendResponse(res, 'success', 200, courseStats);
});

exports.primaryCoursesStatistics = catchAsync(async (req, res, next) => {
	// console.log('good');
	const { semester, academicYear, courseIDs } = req.body;

	let coursesStats = [];
	for (let i = 0; i < courseIDs.length; i++) {
		let courseStat = await calcStatsPerCourse(
			courseIDs[i],
			semester,
			academicYear,
			Course,
			Mark
		);

		coursesStats.push(courseStat);
	}
	sendResponse(res, 'success', 200, coursesStats);
});
