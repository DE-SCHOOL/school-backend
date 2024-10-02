const mongoose = require('mongoose');
const sendResponse = require('../../utilities/sendResponse');
const Student = require('./../../models/students.model');
const Course = require('./../../models/courses.model');
const Specialty = require('./../../models/specialty.model');
const Department = require('./../../models/department.model');
const Program = require('./../../models/programs.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');
const StudentAcademicYear = require('./../../models/student_academic_year.model');

const StaffCourse = require('./../../models/staff_courses.model');
const Timetable = require('../../models/timetable.model');
const FormB = require('../../models/formb.model');

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
		pob,
	} = req.body;
	const { academicYearID } = req.params;

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
		pob,
	});

	await StudentAcademicYear.create({
		student: student?._id,
		academicYear: academicYearID,
		level: level,
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
	const { id, academicYearID } = req.params;

	if (!id || !academicYearID) {
		return next(new ErrorApi('Please provide student and academic year', 400));
	}

	const students = await StudentAcademicYear.aggregate([
		{
			$match: {
				academicYear: new mongoose.Types.ObjectId(academicYearID),
				student: new mongoose.Types.ObjectId(id),
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
		{ $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: 'specialties',
				localField: 'student.specialty',
				foreignField: '_id',
				as: 'student.specialty',
			},
		},
		{
			$unwind: { path: '$student.specialty', preserveNullAndEmptyArrays: true },
		},
		{
			$lookup: {
				from: 'departments',
				localField: 'student.specialty.department',
				foreignField: '_id',
				as: 'student.specialty.department',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'programs',
				localField: 'student.specialty.department.program',
				foreignField: '_id',
				as: 'student.specialty.department.program',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.director',
				foreignField: '_id',
				as: 'student.specialty.department.program.director',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program.director',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.deputyDirector',
				foreignField: '_id',
				as: 'student.specialty.department.program.deputyDirector',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program.deputyDirector',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				level: 1,
				'student._id': 1,
				'student.name': 1,
				'student.matricule': 1,
				'student.address': 1,
				'student.gender': 1,
				'student.dob': 1,
				'student.pob': 1,
				'student.email': 1,
				'student.tel': 1,
				'student.parent_name': 1,
				'student.parent_email': 1,
				'student.parent_tel': 1,
				'student.level': 1,
				'student.entry_certificate': 1,
				// 'student.specialty': 1,
				'student.specialty.name': 1,
				'student.specialty._id': 1,
				// 'student.specialty.department': 1,
				'student.specialty.department.name': 1,
				'student.specialty.department._id': 1,
				// 'student.specialty.department.hod': 1,
				// 'student.specialty.department.hod.name': 1,
				// 'student.specialty.department.hod._id': 1,
				// 'student.specialty.department.program': 1,
				'student.specialty.department.program.name': 1,
				'student.specialty.department.program._id': 1,
				'student.specialty.department.program.director.name': 1,
				'student.specialty.department.program.director._id': 1,
				'student.specialty.department.program.deputyDirector.name': 1,
				'student.specialty.department.program.deputyDirector._id': 1,
			},
		},
	]);

	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	allStudents = allStudents.length > 0 ? allStudents[0] : [];

	sendResponse(res, 'success', 201, allStudents);
});

exports.getAllStudents = catchAsync(async (req, res, next) => {
	const students = await Student.find({}).sort({
		level: 1,
		name: 1,
		specialty: 1,
	});

	sendResponse(res, 'success', 200, students);
});

exports.getStudentPerAcademicYear = catchAsync(async (req, res, next) => {
	const { academicYearID } = req.params;

	// const students = await StudentAcademicYear.find({
	// 	academicYear: academicYearID,
	// })
	// 	.sort({ level: 1 })
	// 	.populate('student');

	const students = await StudentAcademicYear.aggregate([
		{ $match: { academicYear: new mongoose.Types.ObjectId(academicYearID) } },
		{
			$lookup: {
				from: 'students',
				localField: 'student',
				foreignField: '_id',
				as: 'student',
			},
		},
		{ $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: 'specialties',
				localField: 'student.specialty',
				foreignField: '_id',
				as: 'student.specialty',
			},
		},
		{
			$unwind: { path: '$student.specialty', preserveNullAndEmptyArrays: true },
		},
		{
			$lookup: {
				from: 'departments',
				localField: 'student.specialty.department',
				foreignField: '_id',
				as: 'student.specialty.department',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'programs',
				localField: 'student.specialty.department.program',
				foreignField: '_id',
				as: 'student.specialty.department.program',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.director',
				foreignField: '_id',
				as: 'student.specialty.department.program.director',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program.director',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.deputyDirector',
				foreignField: '_id',
				as: 'student.specialty.department.program.deputyDirector',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program.deputyDirector',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				level: 1,
				'student._id': 1,
				'student.name': 1,
				'student.matricule': 1,
				'student.address': 1,
				'student.gender': 1,
				'student.dob': 1,
				'student.pob': 1,
				'student.email': 1,
				'student.tel': 1,
				'student.parent_name': 1,
				'student.parent_email': 1,
				'student.parent_tel': 1,
				'student.level': 1,
				'student.entry_certificate': 1,
				// 'student.specialty': 1,
				'student.specialty.name': 1,
				'student.specialty._id': 1,
				// 'student.specialty.department': 1,
				'student.specialty.department.name': 1,
				'student.specialty.department._id': 1,
				// 'student.specialty.department.hod': 1,
				// 'student.specialty.department.hod.name': 1,
				// 'student.specialty.department.hod._id': 1,
				// 'student.specialty.department.program': 1,
				'student.specialty.department.program.name': 1,
				'student.specialty.department.program._id': 1,
				'student.specialty.department.program.director.name': 1,
				'student.specialty.department.program.director._id': 1,
				'student.specialty.department.program.deputyDirector.name': 1,
				'student.specialty.department.program.deputyDirector._id': 1,
			},
		},
		{ $sort: { level: 1, 'student.name': 1 } },
	]);

	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	// console.log(allStudents, 'JASIO');

	sendResponse(res, 'success', 200, allStudents);
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
	const { courseID, academicYearID } = req.params;

	const course = await Course.findById(courseID);

	let courseInfo = [];
	course.specialty.map((spec) => {
		courseInfo.push(spec._id);
	});

	const level = course.levels;

	// const students = await Student.find({
	// 	specialty: { $in: courseInfo },
	// 	level: { $in: level },
	// });

	const students = await StudentAcademicYear.aggregate([
		{ $match: { academicYear: new mongoose.Types.ObjectId(academicYearID) } },
		{
			$lookup: {
				from: 'students',
				localField: 'student',
				foreignField: '_id',
				as: 'student',
			},
		},
		{ $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
		{
			$lookup: {
				from: 'specialties',
				localField: 'student.specialty',
				foreignField: '_id',
				as: 'student.specialty',
			},
		},
		{
			$unwind: { path: '$student.specialty', preserveNullAndEmptyArrays: true },
		},
		//Another match for all students in the array of specialties and array of levels
		{
			$match: {
				level: { $in: level },
				'student.specialty._id': { $in: courseInfo },
			},
		},
		{
			$lookup: {
				from: 'departments',
				localField: 'student.specialty.department',
				foreignField: '_id',
				as: 'student.specialty.department',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'programs',
				localField: 'student.specialty.department.program',
				foreignField: '_id',
				as: 'student.specialty.department.program',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.director',
				foreignField: '_id',
				as: 'student.specialty.department.program.director',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program.director',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.deputyDirector',
				foreignField: '_id',
				as: 'student.specialty.department.program.deputyDirector',
			},
		},
		{
			$unwind: {
				path: '$student.specialty.department.program.deputyDirector',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$project: {
				level: 1,
				'student._id': 1,
				'student.name': 1,
				'student.matricule': 1,
				'student.address': 1,
				'student.gender': 1,
				'student.dob': 1,
				'student.pob': 1,
				'student.email': 1,
				'student.tel': 1,
				'student.parent_name': 1,
				'student.parent_email': 1,
				'student.parent_tel': 1,
				'student.level': 1,
				'student.entry_certificate': 1,
				// 'student.specialty': 1,
				'student.specialty.name': 1,
				'student.specialty._id': 1,
				// 'student.specialty.department': 1,
				'student.specialty.department.name': 1,
				'student.specialty.department._id': 1,
				// 'student.specialty.department.hod': 1,
				// 'student.specialty.department.hod.name': 1,
				// 'student.specialty.department.hod._id': 1,
				// 'student.specialty.department.program': 1,
				'student.specialty.department.program.name': 1,
				'student.specialty.department.program._id': 1,
				'student.specialty.department.program.director.name': 1,
				'student.specialty.department.program.director._id': 1,
				'student.specialty.department.program.deputyDirector.name': 1,
				'student.specialty.department.program.deputyDirector._id': 1,
			},
		},
		{ $sort: { level: 1, 'student.name': 1 } },
	]);

	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	sendResponse(res, 'success', 200, allStudents);
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

	let students = await Student.find({ $or: [search] }).sort({
		level: 1,
		name: 1,
		specialty: 1,
	});

	sendResponse(res, 'success', 200, students);
});

exports.deleteStudent = catchAsync(async (req, res, next) => {
	const id = req.params.id;
	const student = await Student.findByIdAndDelete(id);

	const students = await Student.find({});

	sendResponse(res, 'success', 200, students);
});

exports.getTimetables = catchAsync(async (req, res, next) => {
	const { level, specialty, academicYear } = req.body;

	const timetables = await Timetable.find({
		level,
		specialty,
		academicYear,
	}).sort({ level: -1, semester: 1 });

	sendResponse(res, 'success', 200, timetables);
});

exports.getFormBs = catchAsync(async (req, res, next) => {
	const { level, specialty, academicYear } = req.body;

	const formBs = await FormB.find({
		level,
		specialty,
		academicYear,
	}).sort({ level: -1 });

	sendResponse(res, 'success', 200, formBs);
});
