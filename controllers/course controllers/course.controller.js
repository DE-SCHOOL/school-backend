const Course = require('./../../models/courses.model');
const Program = require('./../../models/programs.model');
const Department = require('./../../models/department.model');
const Specialty = require('./../../models/specialty.model');
// const StaffCourse = require('./../../models/staff_courses.model');
const Mark = require('./../../models/marks.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const { calcStatsPerCourse } = require('../../utilities/controllerFactory');

exports.createCourse = catchAsync(async (req, res, next) => {
	const { name, specialty, code, levels, credit_value, status } = req.body;

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
		levels,
		credit_value,
		status,
	});

	sendResponse(res, 'success', 201, courses);
});

exports.editCourse = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	const { name, specialty, code, levels, credit_value, status } =
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
	const { level, semester } = req.body;
	const dataSearch = { specialty: `${id}`, levels: level };
	if (semester) {
		dataSearch.semester = semester;
	}
	// console.log(dataSearch);
	let courses = await Course.find(dataSearch);

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

exports.getCoursesPerSearch = catchAsync(async (req, res, next) => {
	const { name, specialty, department, level, program } = req.body;
	const searchData = { name, specialty, department, level, program };

	// making the search obj
	let search = { name, levels: [level], specialty };
	for (let key in search) {
		if (search[key] === '' || search[key] === undefined) delete search[key];
		if (level === undefined) delete search['levels'];
	}

	// Specialty || Get all specialties as an array from a given department
	let specialties;
	if (department !== '' && department !== undefined) {
		specialties = await Specialty.find({ department });
		specialties = specialties.map((spec) => `${spec._id}`);

		//add the specialties to the search object
		search = {
			...search,
			specialty: {
				$in: [
					...specialties,
					search?.specialty !== undefined ? search?.specialty : null,
				],
			},
		};
	}

	//Department || Get all specialties as an array from a given program
	let departments;
	if (program !== '' && program !== undefined) {
		//get all departments as an array
		departments = await Department.find({ program });
		departments = departments.map((dep) => `${dep._id}`);

		//get all specialties as an array.
		specialties = await Specialty.find({ department: { $in: departments } });
		specialties = specialties.map((spec) => `${spec._id}`);

		//add the specialties to the search object
		search = {
			...search,
			specialty: {
				$in: [
					...specialties,
					search?.specialty !== undefined ? search?.specialty : null,
				],
			},
		};
	}

	// make provision for insensitive search fo name if it exist
	if (name !== '' && name !== undefined) {
		let regex = new RegExp(name, 'i');
		search.name = { $regex: regex };
	}

	let courses = await Course.find({ $or: [search] }).sort({
		level: 1,
		name: 1,
		specialty: 1,
	});

	// console.log(courses, search);

	sendResponse(res, 'success', 200, courses);
});
exports.getCoursesResit = catchAsync(async (req, res, next) => {
	const { semester } = req.params;
	const { academicYear } = req.body;
	const failedMarks = await Mark.aggregate([
		{
			$addFields: {
				total: { $sum: [`$${semester}CA`, `$${semester}Exam`] },
			},
		},
		{
			$lookup: {
				from: 'courses',
				localField: 'course',
				foreignField: '_id',
				as: 'course',
			},
		},
		{
			$lookup: {
				from: 'students',
				localField: 'student',
				foreignField: '_id',
				as: 'student',
			},
		},
		{
			$match: {
				total: { $lt: 40 },
				academicYear,
			},
		},
	]);

	sendResponse(res, 'Success', 200, failedMarks);
});
