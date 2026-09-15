const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Staff = require('./../../models/staff.model');

exports.getAllStaffs = catchAsync(async (req, res, next) => {
	const staffs = await Staff.find({ isHidden: { $ne: true } });

	// console.log('This is nonsense');
	if (!staffs) return next(new ErrorApi('Staffs were not found', 404));
	// console.log('this is not good the second');
	sendResponse(res, 'success', 200, staffs);
});

exports.getStaff = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const staff = await Staff.findById(id);

	if (!staff) return next(new ErrorApi('Staff not found', 404));

	sendResponse(res, 'success', 200, staff);
});

exports.editStaff = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	if (req.body?.password || req.body?.password === '') delete req.body.password;
	if (req.body?.confirmPassword || req.body?.confirmPassword === '')
		delete req.body.confirmPassword;
	const staff = await Staff.findByIdAndUpdate(id, req.body, {
		new: true,
		runValidators: true,
	});

	if (!staff) return next(new ErrorApi('Staff not found', 404));

	sendResponse(res, 'success', 200, staff);
});

exports.deleteStaff = catchAsync(async (req, res, next) => {
	const id = req.params.id;
	const staff = await Staff.findByIdAndDelete(id);

	const staffs = await Staff.find({});

	sendResponse(res, 'success', 200, staffs);
});
