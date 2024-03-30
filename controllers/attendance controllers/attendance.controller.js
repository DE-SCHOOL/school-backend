const Attendance = require('./../../models/attendance.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');
const sendResponse = require('./../../utilities/sendResponse');

exports.createAttendanceSheet = catchAsync(async (req, res, next) => {
	const { students } = req.body;

	let attendanceList = [];
	for (let i = 0; i < students.length; i++) {
		let studAttendance = await Attendance.create({ student: students[i] });

		attendanceList.push(studAttendance);
	}
});

exports.attendanceMorning = catchAsync(async (req, res, next) => {
	const { students, attendaces } = req.body;

	for (let i = 0; i < students.length; i++) {
		let studAttendance = await Attendance.find({ student: students[i] });

		console.log(studAttendance.attendace);
	}

	sendResponse(res, 'success', 200, []);
});
