const StudentAcademicYear = require('./../../models/student_academic_year.model');
const ErrorAPI = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Student = require('../../models/students.model');

exports.createStudentAcademicYearBulk = catchAsync(async (req, res, next) => {
	const { studentIDs, toYearID } = req.body;

	if (!studentIDs || studentIDs.length === 0) {
		return next(new ErrorAPI('Please provide students to be promoted', 400));
	}

	let studentAcademicYear = [];
	for (i = 0; i < studentIDs.length; i++) {
		studentAcademicYear[i] = await StudentAcademicYear.create({
			student: studentIDs[i],
			academicYear: toYearID,
		});
	}

	sendResponse(res, 201, 'success', []);
});

exports.promoteStudent = catchAsync(async (req, res, next) => {
	const { studentID, toYear, newClass } = req.body;
	const academicYear = req.params.academicYearID;

	if (!studentID || !toYear) {
		return next(new ErrorAPI('Please provide student and academic year', 400));
	}

	await Student.findByIdAndUpdate(
		studentID,
		{
			level: newClass,
		},
		{ new: true }
	);

	const studentAcademicYear = await StudentAcademicYear.create({
		student: studentID,
		academicYear: toYear,
	});

	const students = await StudentAcademicYear.find({ academicYear }).populate(
		'student'
	);

	let allStudents = students.map((stud) => stud.student);

	sendResponse(res, 'success', 201, allStudents);
});

exports.getStudentPerAcademicYear = catchAsync(async (req, res, next) => {
	const academicYear = req.params.academicYearID;

	const students = await StudentAcademicYear.find({ academicYear }).populate(
		'student'
	);

	let allStudents = students.map((stud) => stud.student);

	sendResponse(res, 'success', 200, allStudents);
});
