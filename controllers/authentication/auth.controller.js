const Staff = require('../../models/staff.model');
const ErrorApi = require('../../utilities/ErrorApi');
const { createToken, verifyToken } = require('../../utilities/jwt');
const catchAsync = require('./../../utilities/catchAsync');
const sendResponse = require('./../../utilities/sendResponse');

exports.register = catchAsync(async (req, res, next) => {
	const {
		name,
		role,
		email,
		password,
		confirmPassword,
		tel,
		gender,
		address,
		dob,
	} = req.body;
	const staff = await Staff.create({
		name,
		email,
		password,
		confirmPassword,
		tel,
		gender,
		address,
		dob,
		role,
	});

	staff.password = undefined;

	const id = `${staff._id}`;
	const token = await createToken(id);
	staff._doc.token = token;

	sendResponse(res, 'success', 201, staff);
});

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;

	if (!email || !password)
		return next(new ErrorApi('Email or password missing', 400));

	const query = Staff.findOne({ email });
	query.select('+password');

	const staff = await query;
	const hashedPassword = staff.password;

	const isCorrect = await staff.isPasswordCorrect(hashedPassword, password);
	if (!isCorrect)
		return next(new ErrorApi('Incorrect password, please try again', 401));

	const token = await createToken(`${staff._id}`);

	staff._doc.token = token;
	sendResponse(res, 'success', 200, staff);
});

exports.protect = catchAsync(async (req, res, next) => {
	let token = req.headers;
	token = token?.authorization?.split(' ')[1];

	if (!token)
		return next(
			new ErrorApi('No token, please login to be an authorized user', 401)
		);

	const tokenInfo = await verifyToken(token);

	const userInfo = { ...tokenInfo };

	const user = await Staff.findById(userInfo.id);

	if (!user)
		return next(
			new ErrorApi('Something went wrong. Please login to continue', 403)
		);

	req.staff = user;
	next();
});

exports.restrictTo = (...roles) => {
	return (req, res, next) => {
		// console.log(req.staff);
		const { role } = req.staff;
		// console.log(role, roles);
		if (!roles.includes(role)) {
			return next(
				new ErrorApi('You do not have permission to perform this action', 403)
			);
		}
		next();
	};
};
exports.forgetPassword = catchAsync(async (req, res, next) => {});
exports.resetPassword = catchAsync(async (req, res, next) => {});
