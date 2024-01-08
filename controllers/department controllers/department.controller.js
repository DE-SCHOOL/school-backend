const sendResponse = require('../../utilities/sendResponse');
const Department = require('./../../models/department.model');
const Staff = require('./../../models/staff.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.createDepartment = catchAsync(async (req, res, next) => {
	const { name, program, hod } = req.body;

	const department = await Department.create({ name, hod, program });

	if (!department) return next(new ErrorApi('Department not created', 400));

	//Update new HOD to role of hod
	await Staff.findByIdAndUpdate(hod, { role: 'hod' });

	sendResponse(res, 'success', 201, department);
});

exports.editDepartment = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	const { name, program, hod } = req.body;

	const department = await Department.findByIdAndUpdate(
		id,
		{
			name,
			hod,
			program,
		},
		{ new: true, runValidators: true }
	);

	if (!department) return next(new ErrorApi('Department not found', 404));

	//Update new department to role of hod
	await Staff.findByIdAndUpdate(hod, { role: 'hod' });

	sendResponse(res, 'success', 200, department);
});

exports.getAllDepartments = catchAsync(async (req, res, next) => {
	const departments = await Department.find({});

	sendResponse(res, 'success', 200, departments);
});

exports.getDepartment = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	const department = await Department.findById(id);

	if (!department) return next(new ErrorApi('No deparment found', 404));

	sendResponse(res, 'success', 200, department);
});
