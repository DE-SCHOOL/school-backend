const sendResponse = require('../../utilities/sendResponse');
const Department = require('./../../models/department.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.createDepartment = catchAsync(async (req, res, next) => {
	const { name, program, hod } = req.body;

	const department = await Department.create({ name, hod, program });

	if (!department) return next(new ErrorApi('Department not created', 400));

	sendResponse(res, 'success', 201, department);
});

exports.getAllDepartments = catchAsync(async (req, res, next) => {
	const departments = await Department.find({});

	sendResponse(res, 'success', 200, departments);
});
