const mongoose = require('mongoose');
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

exports.deletePromotedStudent = catchAsync(async (req, res, next) => {
	const { studentID, newClass, currentYearID } = req.body;
	const { nextAcademicYearID } = req.params;

	if (!studentID || !nextAcademicYearID)
		return new ErrorAPI(
			'Please provide student information and academic year inforation',
			400
		);

	await Student.findByIdAndUpdate(
		studentID,
		{
			level: newClass,
		},
		{ new: true, runValidators: true }
	);

	await StudentAcademicYear.deleteOne({
		academicYear: nextAcademicYearID,
		student: studentID,
	});

	const students = await StudentAcademicYear.find({
		academicYear: currentYearID,
	})
		.populate('student')
		.sort({ level: 1 });

	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	sendResponse(res, 'success', 200, allStudents); //normally deleted is 204

	// sendResponse(res, 'success', 200, []);
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

	await StudentAcademicYear.create({
		student: studentID,
		academicYear: toYear,
		level: newClass,
	});

	const students = await StudentAcademicYear.find({
		academicYear,
	})
		.populate('student')
		.sort({ level: 1 });

	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

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
	})
		.populate('student')
		.sort({ level: 1 });

	let allStudents = studentsData.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	sendResponse(res, 'success', 201, allStudents);
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
		{ $unwind: '$student' },
		{
			$lookup: {
				from: 'specialties',
				localField: 'student.specialty',
				foreignField: '_id',
				as: 'student.specialty',
			},
		},
		{ $unwind: '$student.specialty' },
		{
			$lookup: {
				from: 'departments',
				localField: 'student.specialty.department',
				foreignField: '_id',
				as: 'student.specialty.department',
			},
		},
		{ $unwind: '$student.specialty.department' },
		{
			$lookup: {
				from: 'programs',
				localField: 'student.specialty.department.program',
				foreignField: '_id',
				as: 'student.specialty.department.program',
			},
		},
		{ $unwind: '$student.specialty.department.program' },
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.director',
				foreignField: '_id',
				as: 'student.specialty.department.program.director',
			},
		},
		{ $unwind: '$student.specialty.department.program.director' },
		{
			$lookup: {
				from: 'staffs',
				localField: 'student.specialty.department.program.deputyDirector',
				foreignField: '_id',
				as: 'student.specialty.department.program.deputyDirector',
			},
		},
		{
			$unwind: '$student.specialty.department.program.deputyDirector',
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

	console.log(students);
	console.log(
		students.length,
		'1---------------------------------------------'
	);
	let allStudents = students.map((stud) => {
		const student = stud.student;
		student.level = stud.level;
		return student;
	});

	console.log(
		'2----------------------------------------------------------------',
		allStudents
	);
	console.log(
		allStudents.length,
		'3---------------------------------------------'
	);

	// console.log(allStudents, 'JASIO');

	sendResponse(res, 'success', 200, allStudents);
});

exports.getStudentAccrossYears = catchAsync(async (req, res, next) => {
	const { studentId } = req.params;

	const student = await StudentAcademicYear.aggregate([
		{
			$match: { student: new mongoose.Types.ObjectId(studentId) },
		},
		{
			$lookup: {
				from: 'academic_years',
				localField: 'academicYear',
				foreignField: '_id',
				as: 'academicYear',
			},
		},
		{
			$project: {
				level: 1,
				'academicYear.isCurrent': 1,
				'academicYear.schoolYear': 1,
			},
		},
	]);

	if (!student) return new ErrorAPI('Student Not Found!', 404);

	sendResponse(res, 'success', 200, student);
});

// {
// 	$project: {
// 			level: 1,
// 			student: {
// 					_id: 1,
// 					name: 1,
// 					matricule: 1,
// 					address: 1,
// 					gender: 1,
// 					dob: 1,
// 					pob: 1,
// 					email: 1,
// 					tel: 1,
// 					parent_name: 1,
// 					parent_email: 1,
// 					parent_tel: 1,
// 					level: 1,
// 					entry_certificate: 1,
// 					specialty: {
// 							name: 1,
// 							_id: 1,
// 							department: {
// 									name: 1,
// 									_id: 1,
// 									program: {
// 											name: 1,
// 											_id: 1,
// 											director: {
// 													name: 1,
// 													_id: 1,
// 											},
// 											deputyDirector: {
// 													name: 1,
// 													_id: 1,
// 											},
// 									},
// 							},
// 					},
// 			},
// 	},
// },
