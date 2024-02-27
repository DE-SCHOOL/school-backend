const Mark = require('./../../models/marks.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const Course = require('./../../models/courses.model');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Student = require('../../models/students.model');

exports.createStudentsMark = catchAsync(async (req, res, next) => {
	const { courseID } = req.params;
	const { students, academicYear } = req.body;

	let studentsMark = [];
	for (let i = 0; i < students.length; i++) {
		studentsMark[i] = await Mark.create({
			course: courseID,
			student: students[i],
			academicYear: '2023/2024',
		});
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
	sendResponse(res, 'success', 201, studentsMark);
});

exports.getAllStudentsMarkSheet = catchAsync(async (req, res, next) => {
	const allStudentsMark = await Mark.find({});

	sendResponse(res, 'success', 200, allStudentsMark);
});

exports.getMarkSheetsPerCoursePerStudents = catchAsync(
	async (req, res, next) => {
		const course = req.params.courseID;
		const { students } = req.body;
		const studentsMarksheet = await Mark.find({
			course,
			student: { $in: students },
		});

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

		const students = await Student.find({ _id: studIDs });

		//get specialty IDs
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
		// console.log(courses, myCourse2D);

		//Find student results based on his/her courses and academicYear
		let j = 0;
		let results = studIDs.map(async (studID) => {
			let search = { student: studID, academicYear, course: myCourse2D[j] };
			j = j + 1;
			return await Mark.find(search);
		});

		let allValues = await Promise.all(results);

		sendResponse(res, 'success', 200, allValues);
	}
);

// exports.getAllStudentMarkSheetAllCourses = catchAsync(
// 	async (req, res, next) => {
// 		const { studID: studIDs, academicYear } = req.body;

// 		if (studIDs === undefined || academicYear === undefined) {
// 			return next(
// 				new ErrorApi('Courses, studID and level must be provided', 400)
// 			);
// 		}

// 		let results = studIDs.map(async (studID, index) => {
// 			let search = { student: studID, academicYear, course: { $ne: null } };
// 			return await Mark.find(search);
// 		});

// 		let allValues = await Promise.all(results);

// 		sendResponse(res, 'success', 200, allValues);
// 	}
// );

// http://localhost:8000/api/v1/mark/all/student/courses/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1NWEyNTI1MGRhODJkZmY1ZmMwYTEzYSIsImlhdCI6MTcwNjYzNzIwNSwiZXhwIjoxNzE0NDEzMjA1fQ.hDfjLtmvwInFwGGftXUnjqa7TPzxQmfbk_bHRklr-88
