const Staff = require('../../models/staff.model');
const ErrorApi = require('../../utilities/ErrorApi');
const { createToken, verifyToken } = require('../../utilities/jwt');
const catchAsync = require('./../../utilities/catchAsync');
const sendResponse = require('./../../utilities/sendResponse');
const { auth } = require('./../../firebase.config');

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
		pob,
		picture,
		high_certificate,
		marital_status,
		isHidden,
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
		pob,
		picture,
		high_certificate,
		marital_status,
		isHidden: isHidden !== undefined ? isHidden : false,
	});

	staff.password = undefined;

	const id = `${staff._id}`;
	const token = await createToken(id, process.env.JWT_SECRET);

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

	// console.log(email);
	const staff = await Staff.findOne({ email }).select('+password');

	if (!staff) return next(new ErrorApi('User not found with this email', 403));
	// console.log(staff);
	const hashedPassword = staff.password;

	const isCorrect = await staff.isPasswordCorrect(hashedPassword, password);
	if (!isCorrect)
		return next(new ErrorApi('Incorrect password, please try again', 401));

	const token = await createToken(`${staff._id}`, process.env.JWT_SECRET);

	let cookieOption = {};
	cookieOption = {
		httpOnly: true,
		expires: new Date(
			Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
		),
	};

	//Create custom auth token and add to request
	console.log(staff._id, 'IDDDDDDDDDDDDDDDD');
	const customToken = await auth.createCustomToken(`${staff._id}`, {
		role: staff.role,
	});

	res.cookie('jwt', token, cookieOption);

	staff._doc.token = token;
	staff._doc.password = undefined;
	staff._doc.customToken = customToken;
	sendResponse(res, 'success', 200, staff);
});

exports.protect = catchAsync(async (req, res, next) => {
	//IN PURE DEVELOPMENT
	// let token = req.headers;
	// token = token?.authorization?.split(' ')[1];
	// console.log(req.cookies, 'JWT CHECKING', token, 'TOKEN FOXFIRE');
	// let token = req.cookies.jwt;

	// let token = req.params;
	// console.log(req.params.tokenID, 222222333333333333);
	let token = req.params.tokenID;
	if (!token)
		return next(
			new ErrorApi('No token, please login to be an authorized user', 401)
		);

	const tokenInfo = await verifyToken(token, process.env.JWT_SECRET);

	const userInfo = { ...tokenInfo };

	const user = await Staff.findById(`${userInfo.id}`);

	if (!user)
		return next(
			new ErrorApi('Something went wrong. Please login to continue', 403)
		);

	req.staff = user;

	next();
});

exports.restrictTo = (...roles) => {
	return (req, res, next) => {
		// console.log(req.staff, 1111111111111111111111111);
		const { role } = req.staff;
		// console.log(role, roles);
		// console.log(role, 'ROLE');
		if (!roles.includes(role)) {
			return next(
				new ErrorApi('You do not have permission to perform this action', 403)
			);
		}
		next();
	};
};

exports.logOut = catchAsync(async (req, res, next) => {
	// res.cookie('jwt', 'loged-out', {
	// 	httpOnly: true,
	// 	expires: new Date(
	// 		Date.now() + process.env.COOKIE_EXP * 24 * 60 * 60 * 1000
	// 	),
	// 	// domain: '.vercel.com',
	// 	// secure: true,
	// 	// sameSite: 'None',

	// 	//EVERYTHING NOW DONE ON THE FRONTEND. LOCAL STORAGE COOKIE REMOVED
	// });
	sendResponse(res, 'success', 200, [{ token: '' }]);
});
exports.forgetPassword = catchAsync(async (req, res, next) => {});
exports.resetPassword = catchAsync(async (req, res, next) => {});
