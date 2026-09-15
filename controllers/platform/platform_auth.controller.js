const PlatformStaff = require('../../models/platform_staff.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');
const { createToken, verifyToken } = require('../../utilities/jwt');

// Platform staff sign in with email/password like school staff do, but
// against a completely separate collection and JWT secret
// (JWT_SECRET_PLATFORM, not JWT_SECRET) — a leaked or forged school-staff
// token must never be usable here, and vice versa.
exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;

	if (!email || !password) {
		return next(new ErrorApi('Email or password missing', 400));
	}

	// No skipTenantScope needed: platform_staff.model.js never has
	// tenantScope.plugin applied (platform staff belong to no school), so
	// there's no scoping hook here to opt out of.
	const platformStaff = await PlatformStaff.findOne({ email }).select(
		'+password'
	);

	if (!platformStaff) {
		return next(new ErrorApi('User not found with this email', 403));
	}

	const isCorrect = await platformStaff.isPasswordCorrect(
		password,
		platformStaff.password
	);

	if (!isCorrect) {
		return next(new ErrorApi('Incorrect password, please try again', 401));
	}

	const token = await createToken(
		`${platformStaff._id}`,
		process.env.JWT_SECRET_PLATFORM
	);

	platformStaff._doc.password = undefined;
	platformStaff._doc.token = token;

	sendResponse(res, 'success', 200, platformStaff);
});

exports.protect = catchAsync(async (req, res, next) => {
	const token = req.params.tokenID;

	if (!token) {
		return next(
			new ErrorApi('No token, please login to be an authorized user', 401)
		);
	}

	const decoded = await verifyToken(token, process.env.JWT_SECRET_PLATFORM);

	const platformStaff = await PlatformStaff.findById(decoded.id);

	if (!platformStaff) {
		return next(
			new ErrorApi('Something went wrong. Please login to continue', 403)
		);
	}

	req.platformStaff = platformStaff;
	next();
});

exports.restrictTo = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.platformStaff.role)) {
			return next(
				new ErrorApi('You do not have permission to perform this action', 403)
			);
		}
		next();
	};
};
