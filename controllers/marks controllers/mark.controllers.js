const Mark = require('./../../models/marks.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');

exports.createStudentsMark = catchAsync(async (req, res, next) => {
	const { courseID } = req.params;
	const { students, academicYear } = req.body;
	// console.log(students, 111111);
	let studentsMark = [];
	for (let i = 0; i < students.length; i++) {
		studentsMark[i] = await Mark.create({
			course: courseID,
			student: students[i],
			academicYear: '2023/2024',
		});
	}
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
		}).exec();

		studentsMarksheet.sort((a, b) => {
			const nameA = a.student.name.toUpperCase();
			const nameB = b.student.name.toUpperCase();

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

	let studentsMark = [];
	for (let i = 0; i < students.length; i++) {
		studentsMark[i] = await Mark.findOneAndUpdate(
			{ student: students[i], course: courseID },
			{ [markType]: marks[i] },
			{ new: true }
		);
	}
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
