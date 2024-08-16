const StudentAcademicYear = require('./../../models/student_academic_year.model');
const ErrorAPI = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Student = require('../../models/students.model');

exports.createStudentAcademicYearBulk = catchAsync(async (req, res, next) => {
	const { students, toYearID } = req.body;

	if (!students || students.length === 0) {
		return next(new ErrorAPI('Please provide students to be promoted', 400));
	}

	let studentAcademicYear = [];
	for (i = 0; i < students.length; i++) {
		studentAcademicYear[i] = await StudentAcademicYear.create({
			student: students[i]._id,
			academicYear: toYearID,
			level: students[i].level,
		});
	}

	sendResponse(res, 'success', 201, []);
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
		{ new: true, runValidators: true }
	);

	const studentAcademicYear = await StudentAcademicYear.create({
		student: studentID,
		academicYear: toYear,
		level: newClass,
	});

	const students = await StudentAcademicYear.find({ academicYear }).populate(
		'student'
	);

	let allStudents = students.map((stud) => stud.student);

	sendResponse(res, 'success', 201, allStudents);
});

exports.promoteStudentsBulk = catchAsync(async (req, res, next) => {
	// const { studentID, toYear, newClass } = req.body;
	const { students } = req.body;
	const academicYear = req.params.academicYearID;

	if (students.length === 0 || !students) {
		return next(
			new ErrorAPI('Please provide student and academic year information', 400)
		);
	}

	for (i = 0; i < students.length; i++) {
		await Student.findByIdAndUpdate(
			students[i].studentID,
			{
				level: students[i].newClass,
			},
			{ new: true, runValidators: true }
		);

		await StudentAcademicYear.create({
			student: students[i].studentID,
			academicYear: students[i].toYear,
			level: students[i].newClass,
		});
	}

	const studentsData = await StudentAcademicYear.find({
		academicYear,
	}).populate('student');

	let allStudents = studentsData.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	sendResponse(res, 'success', 201, allStudents);
});

exports.getStudentPerAcademicYear = catchAsync(async (req, res, next) => {
	const academicYear = req.params.academicYearID;

	const students = await StudentAcademicYear.find({ academicYear }).populate(
		'student'
	);

	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	// console.log(allStudents, 'JASIO');

	sendResponse(res, 'success', 200, allStudents);
});
