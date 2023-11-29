const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Staff = require('./../../models/staff.model');

exports.getAllStaffs = catchAsync(async (req, res, next) => {
	const staffs = await Staff.find({});

	// console.log('This is nonsense');
	if (!staffs) return next(new ErrorApi('Staffs were not found'));
	// console.log('this is not good the second');
	sendResponse(res, 'success', 200, staffs);
});
