const sendResponse = require('../../utilities/sendResponse');
const Student = require('./../../models/students.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

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

exports.getAllStudents = catchAsync(async (req, res, next) => {
	const students = await Student.find({});

	sendResponse(res, 'success', 200, students);
});
