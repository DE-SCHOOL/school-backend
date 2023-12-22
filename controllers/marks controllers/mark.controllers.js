const Mark = require('./../../models/marks.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');

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
	sendResponse(res, 'success', 201, studentsMark);
});

exports.getAllStudentsMarksPerCourse = catchAsync(async (req, res, next) => {
	const allStudentsMark = await Mark.find({});

	sendResponse(res, 'success', 200, allStudentsMark);
});

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
