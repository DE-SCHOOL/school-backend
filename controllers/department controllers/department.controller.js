const sendResponse = require('../../utilities/sendResponse');
const Department = require('./../../models/department.model');
const Staff = require('./../../models/staff.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.createDepartment = catchAsync(async (req, res, next) => {
	const { name, program, hod } = req.body;

	// if (1) return next(new ErrorApi({ name, program, hod, role: 'hodd' }));
	if (`${req.staff._id}` !== `${hod}`)
		await Staff.findByIdAndUpdate(hod, { role: 'hod' });

	const department = await Department.create({ name, hod, program });

	if (!department) return next(new ErrorApi('Department not created', 400));

	sendResponse(res, 'success', 201, department);
});

exports.getAllDepartments = catchAsync(async (req, res, next) => {
	console.log('Great things ');
	const departments = await Department.find({});

	sendResponse(res, 'success', 200, departments);
});
