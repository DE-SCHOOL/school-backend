const mongoose = require('mongoose');
const Mark = require('./../../models/marks.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const Course = require('./../../models/courses.model');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Student = require('../../models/students.model');
const StudentAcademicYear = require('./../../models/student_academic_year.model');

exports.createStudentsMark = catchAsync(async (req, res, next) => {
	const { courseID } = req.params;
	const { students, academicYear } = req.body;

	// console.log('---------------------------', students, academicYear);
	let studentsMark = [];
	for (let i = 0; i < students.length; i++) {
		studentsMark[i] = await Mark.create({
			course: courseID,
			student: students[i],
			academicYear,
			// academicYear: '2023/2024',
		});
	}

	// console.log('STTTTTTTT', studentsMark);

	studentsMark.sort((a, b) => {
		const nameA = a.student.name?.toUpperCase();
		const nameB = b.student.name?.toUpperCase();

		if (nameA < nameB) {
			return -1;
		}
		if (nameA > nameB) {
			return 1;
		}
		return 0;
	});
	sendResponse(res, 'success', 201, studentsMark);
});

exports.getAllStudentsMarkSheet = catchAsync(async (req, res, next) => {
	const allStudentsMark = await Mark.find({});

	sendResponse(res, 'success', 200, allStudentsMark);
});

exports.getMarkSheetsPerCoursePerStudents = catchAsync(
	async (req, res, next) => {
		const course = req.params.courseID;
		const { students, academicYear } = req.body;
		const studentsMarksheet = await Mark.find({
			course,
			student: { $in: students },
			academicYear,
		});

		// console.log('Jeff', studentsMarksheet, students, academicYear);

		studentsMarksheet.sort((a, b) => {
			const nameA = a.student.name?.toUpperCase();
			const nameB = b.student.name?.toUpperCase();

			if (nameA < nameB) {
				return -1;
			}
			if (nameA > nameB) {
				return 1;
			}
			return 0;
		});
		sendResponse(res, 'success', 200, studentsMarksheet);
	}
);

exports.updateStudentsMark = catchAsync(async (req, res, next) => {
	// const markType = ['s1CA', 's1Exam', 's2CA', 's2Exam', 'preMock', 'mock']; possible values for markType
	const { courseID, markType } = req.params;
	const { marks, students } = req.body;

	// console.log(students, 1111111);
	let studentsMark = [];
	for (let i = 0; i < students.length; i++) {
		studentsMark[i] = await Mark.findOneAndUpdate(
			{ student: students[i], course: courseID },
			{ [markType]: marks[i] },
			{ new: true }
		);
	}

	studentsMark.sort((a, b) => {
		const nameA = a.student.name?.toUpperCase();
		const nameB = b.student.name?.toUpperCase();

		if (nameA < nameB) {
			return -1;
		}
		if (nameA > nameB) {
			return 1;
		}
		return 0;
	});

	sendResponse(res, 'success', 200, studentsMark);
});

exports.getStudentMarkSheetAllCourses = catchAsync(async (req, res, next) => {
	const { courses, studID, academicYear } = req.body;

	if (
		courses === undefined ||
		studID === undefined ||
		academicYear === undefined
	) {
		return next(
			new ErrorApi('Courses, studID and level must be provided', 400)
		);
	}

	const search = { course: courses, student: studID, academicYear };
	let studentSheet = await Mark.find(search);

	sendResponse(res, 'success', 200, studentSheet);
});

exports.getAllStudentMarkSheetAllCourses = catchAsync(
	async (req, res, next) => {
		const { students: studIDs, academicYear, semester } = req.body;

		if (studIDs === undefined || academicYear === undefined) {
			return next(
				new ErrorApi('Courses, studID and level must be provided', 400)
			);
		}

		// const students = await Student.find({ _id: studIDs });
		let students = await StudentAcademicYear.aggregate([
			{
				$match: {
					// academicYear: new mongoose.Types.ObjectId(academicYearID),
					student: {
						$in: studIDs.map((id) => new mongoose.Types.ObjectId(id)),
					},
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
					from: 'academic_years',
					localField: 'academicYear',
					foreignField: '_id',
					as: 'academicYear',
				},
			},
			{ $unwind: { path: '$academicYear', preserveNullAndEmptyArrays: true } },

			{
				$match: { 'academicYear.schoolYear': academicYear },
			},
			{
				$lookup: {
					from: 'specialties',
					localField: 'student.specialty',
					foreignField: '_id',
					as: 'student.specialty',
				},
			},
			{
				$unwind: {
					path: '$student.specialty',
					preserveNullAndEmptyArrays: true,
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
			{ $sort: { level: 1, 'student.name': 1, 'student.specialty.name': 1 } },
		]);

		students = students.map((stud) => {
			const student = stud.student;
			student.level = stud.level;
			return student;
		});

		let specialties = [];
		students.map((student) => {
			specialties.push(student?.specialty?._id);
			return student;
		});

		// console.log(studIDs, specialties);
		//Get student courses per semester for a particular specialty in a particular level
		let courses = [];
		for (i = 0; i < specialties.length; i++) {
			courses[i] = Course.find({
				specialty: specialties[i],
				semester,
				levels: students[i].level,
			});
		}

		courses = await Promise.all(courses);

		//Get CoursesID from courses
		let myCourse2D = [];
		myCourse2D = courses.map((eachArr) => {
			return eachArr.map((course) => {
				return course._id;
			});
		});

		//Find student results based on his/her courses and academicYear
		let j = 0;
		// let allSearch = [];
		let results = studIDs.map(async (studID) => {
			let search = { student: studID, academicYear, course: myCourse2D[j] };

			let query = await Mark.find(search);
			j = j + 1;

			return query;
		});

		let allValues = await Promise.all(results);

		sendResponse(res, 'success', 200, allValues);
	}
);
