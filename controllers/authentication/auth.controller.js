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
		matricule,
		department,
		pob,
		picture,
		high_certificate,
		marital_status,
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
		matricule,
		department,
		pob,
		picture,
		high_certificate,
		marital_status,
	});

	staff.password = undefined;

	const id = `${staff._id}`;
	const token = await createToken(id);

	// res.cookie('jwt', token, {
	// 	httpOnly: true,
	// 	expires: new Date(
	// 		Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
	// 	),
	// 	// secure: false,
	// });

	staff._doc.token = token;

	sendResponse(res, 'success', 201, staff);
});

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;
	// console.log({ email, password });

	if (!email || !password)
		return next(new ErrorApi('Email or password missing', 400));

	console.log('Do not know what is wrong', 1);
	console.log(email);
	const staff = await Staff.findOne({ email }).select('+password');
	// query.select('+password');
	console.log('Do not know what is wrong', 2);

	// const staff = await query;
	console.log('Do not know what is wrong', 3);

	if (!staff) return next(new ErrorApi('User not found with this email', 403));
	// console.log(staff);
	const hashedPassword = staff.password;

	const isCorrect = await staff.isPasswordCorrect(hashedPassword, password);
	if (!isCorrect)
		return next(new ErrorApi('Incorrect password, please try again', 401));

	const token = await createToken(`${staff._id}`);

	res.cookie('jwt', token, {
		httpOnly: true,
		expires: new Date(
			Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
		),
		// secure: false,
	});

	// console.log(token, 'TOKEN TOKEN FIREFOX');

	staff._doc.token = token;
	sendResponse(res, 'success', 200, staff);
});

exports.protect = catchAsync(async (req, res, next) => {
	//IN PURE DEVELOPMENT
	// let token = req.headers;
	// token = token?.authorization?.split(' ')[1];
	console.log('Don"t know what to say', 1);
	let token = req.cookies.jwt;
	// console.log(req.cookies, 'JWT CHECKING', token, 'TOKEN FOXFIRE');
	if (!token)
		return next(
			new ErrorApi('No token, please login to be an authorized user', 401)
		);
	console.log('Don"t know what to say', 2);
	const tokenInfo = await verifyToken(token);

	const userInfo = { ...tokenInfo };

	console.log('Don"t know what to say', 3, userInfo.id);
	const user = await Staff.findById(`${userInfo.id}`);

	console.log('Don"t know what to say', 4);
	if (!user)
		return next(
			new ErrorApi('Something went wrong. Please login to continue', 403)
		);

	console.log('Don"t know what to say', 5);
	req.staff = user;
	console.log('Don"t know what to say');

	next();
});

exports.restrictTo = (...roles) => {
	return (req, res, next) => {
		// console.log(req.staff, 1111111111111111111111111);
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

exports.logOut = catchAsync(async (req, res, next) => {
	res.cookie('jwt', '', {
		httpOnly: true,
		expires: new Date(
			Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
		),
		// secure: false,
	});

	sendResponse(res, 'success', 200, [{ token: '' }]);
});
exports.forgetPassword = catchAsync(async (req, res, next) => {});
exports.resetPassword = catchAsync(async (req, res, next) => {});
