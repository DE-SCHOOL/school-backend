const sendResponse = require('../../utilities/sendResponse');
const Student = require('./../../models/students.model');
const Course = require('./../../models/courses.model');
const Specialty = require('./../../models/specialty.model');
const Department = require('./../../models/department.model');
const Program = require('./../../models/programs.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

const StaffCourse = require('./../../models/staff_courses.model');

exports.createStudent = catchAsync(async (req, res, next) => {
	const {
		name,
		matricule,
		specialty,
		address,
		gender,
		dob,
		email,
		tel,
		parent_name,
		parent_email,
		parent_tel,
		level,
		entry_certificate,
		pod,
	} = req.body;

	const student = await Student.create({
		name,
		matricule,
		specialty,
		address,
		gender,
		dob,
		email,
		tel,
		parent_name,
		parent_email,
		parent_tel,
		level,
		entry_certificate,
		pod,
	});

	if (!student) return next(new ErrorApi('Student not created', 400));

	sendResponse(res, 'success', 201, student);
});

exports.editStudent = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const student = await Student.findByIdAndUpdate(id, req.body, {
		new: true,
		runValidators: true,
	});

	if (!student) return next(new ErrorApi('No student found with this ID', 404));

	sendResponse(res, 'success', 200, student);
});

exports.getStudent = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const student = await Student.findById(id);

	if (!student)
		return next(new ErrorApi('Student not found with this ID', 404));

	sendResponse(res, 'success', 200, student);
});

exports.getAllStudents = catchAsync(async (req, res, next) => {
	const students = await Student.find({});

	sendResponse(res, 'success', 200, students);
});

exports.getStudentsPerStaff = catchAsync(async (req, res, next) => {
	const myID = req.params.staffID;

	//get all courses assigned to a aparticular teacher
	const staffCourse = await StaffCourse.find({ staff: myID });

	//get the levels the courses are being taught as an array of repeatetive levels
	const levelsRepeat = staffCourse
		.map((item) => {
			let course = item.courses.map((course) => course.levels.join(','));
			return course.toString();
		})
		.join(',')
		.split(',');

	//filter the levels to get only the distinct levels
	let levels = [];
	levelsRepeat.map((level) => {
		if (!levels.includes(level)) {
			levels.push(level);
			return level;
		}
	});
	levels = levels.map((level) => Number(level));
	// console.log(levels);
	//Now get all students who are in any of the levels found in the levels array
	const students = await Student.find({ level: { $in: levels } });
	sendResponse(res, 'success', 200, students);
});

exports.getStudentsPerCourseOffering = catchAsync(async (req, res, next) => {
	const { courseID } = req.params;

	const course = await Course.findById(courseID);

	let courseInfo = [];
	course.specialty.map((spec) => {
		courseInfo.push(spec._id);
	});

	const level = course.levels;

	const students = await Student.find({
		specialty: { $in: courseInfo },
		level: { $in: level },
	});

	sendResponse(res, 'success', 200, students);
});

exports.getStudentPerSearch = catchAsync(async (req, res, next) => {
	const { name, specialty, department, level, program } = req.body;
	const searchData = { name, specialty, department, level, program };

	// making the search obj
	let search = { name, level, specialty };
	for (let key in search) {
		if (search[key] === '' || search[key] === undefined) delete search[key];
	}

	// Specialty || Get all specialties as an array from a given department
	let specialties;
	if (department !== '' && department !== undefined) {
		specialties = await Specialty.find({ department });
		specialties = specialties.map((spec) => `${spec._id}`);

		//add the specialties to the search object
		search = { ...search, specialty: { $in: specialties } };
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
		search = { ...search, specialty: { $in: specialties } };
	}

	// make provision for insensitive search fo name if it exist
	if (name !== '' && name !== undefined) {
		let regex = new RegExp(name, 'i');
		search.name = { $regex: regex };
	}
	// console.log(search, 'search');

	let students = await Student.find({ $or: [search] }).sort({
		level: 1,
		name: 1,
		specialty: 1,
	});

	sendResponse(res, 'success', 200, students);
});
