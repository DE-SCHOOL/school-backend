const Course = require('./../../models/courses.model');
const Mark = require('./../../models/marks.model');
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

	const courseMarkInfo = await Mark.find({ course: courseID, academicYear });

	//total students sat for exam and/or ca and have scores not equal to zero (0)
	const studentsSat = courseMarkInfo.filter(
		(mark) => mark[`${semester}Total`] !== 0
	);

	const totalSat = studentsSat.length;

	//total passed
	const totalPassed = courseMarkInfo.filter(
		(mark) => mark[`${semester}Total`] >= 50
	).length;

	//Number of As
	const totalAs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'A'
	).length;

	//Number of B+s
	const totalBplus = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'B+'
	).length;

	//Number of Bs
	const totalBs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'B'
	).length;

	//number of Cs
	const totalCs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'C'
	).length;

	//Number of C+s
	const totalCplus = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'C+'
	).length;

	//Number of Ds
	const totalDs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'D'
	).length;

	//Number of Fs who actually sat and wrote the exam and/or ca
	const totalFs = studentsSat.filter(
		(mark) => mark[`${semester}Grade`] === 'F'
	).length;

	//boys who sat and wrote the exam and/or ca
	const boyStudents = studentsSat.filter(
		(stud) => stud.student?.gender === 'male'
	);

	//total number of boys who passed
	const totalBoysPassed = boyStudents.filter(
		(mark) => mark[`${semester}Total`] >= 50
	).length;

	//girls who sat and wrote the exam and/or ca
	const girlStudents = studentsSat.filter(
		(stud) => stud.student?.gender === 'female'
	);

	//total number of girls who passed
	const totalGirlsPassed = girlStudents.filter(
		(mark) => mark[`${semester}Total`] >= 50
	).length;

	//number of students with marks Less than 40 who wrote exam and/or ca
	const numMarksLess40 = studentsSat.filter(
		(mark) => mark[`${semester}Total`] <= 40
	).length;

	//number of students with marks Less than or equal 45 and greater than 41 who wrote exam and/or ca
	const numMarksBtw41and45 = studentsSat.filter(
		(mark) => mark[`${semester}Total`] <= 45 && mark[`${semester}Total`] >= 41
	).length;

	//number of students with marks Less than 49 and greater than or equal 46 who wrote exam and/or ca
	const numMarksBtw46and49 = studentsSat.filter(
		(mark) => mark[`${semester}Total`] <= 49 && mark[`${semester}Total`] >= 46
	).length;

	const courseStats = {
		totalOffering: courseMarkInfo.length,
		totalSat,
		percentPassed: 1 * ((totalPassed / totalSat) * 100).toFixed(1) || 0,
		percentFailed: 100 - ((totalPassed / totalSat) * 100).toFixed(1) || 0,
		totalAs,
		totalBplus,
		totalBs,
		totalCplus,
		totalCs,
		totalDs,
		totalFs,
		percentPassedBoys:
			((totalBoysPassed / boyStudents.length) * 100).toFixed(1) || 0,
		percentPassedGirls:
			((totalGirlsPassed / girlStudents.length) * 100).toFixed(1) || 0,
		numMarksLess40,
		numMarksBtw41and45,
		numMarksBtw46and49,
	};
	// console.log(courseStats);

	sendResponse(res, 'success', 200, courseStats);
});
