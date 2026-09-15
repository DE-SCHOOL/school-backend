const sendErrorDev = (err, code, res) => {
	res.status(code).json({
		status: err.status || 'Error',
		message: err.message,
		err,
		stack: err.stack,
	});
};

const sendErrorProd = (err, code, res) => {
	if (err.isOperational) {
		res.status(code).json({
			status: err.status || 'Error',
			message: err.message,
		});
	} else {
		err.message = 'Something went very wrong';

		res.status(code).json({
			status: err.status || 'Error',
			message: err.message,
		});
	}
};

// jsonwebtoken throws plain Errors (JsonWebTokenError for a malformed/
// invalid/wrong-secret token, TokenExpiredError for an expired-but-
// otherwise-valid one) with no .statusCode of their own — every
// protect() (staff, student, platform) calls verifyToken() unguarded,
// so any bad token previously fell through to the generic 500 default
// below instead of a 401. Found via Stage 3's tenant-isolation
// verification script, which deliberately sends a garbage token.
const STATUS_CODE_BY_ERROR_NAME = {
	JsonWebTokenError: 401,
	TokenExpiredError: 401,
};

module.exports = (err, req, res, next) => {
	const statusCode =
		err.statusCode || STATUS_CODE_BY_ERROR_NAME[err.name] || 500;
	const message = err.message ? err.message : 'Something went very wrong';

	if (process.env.NODE_ENV === 'development') {
		sendErrorDev(err, statusCode, res);
	} else {
		// Anything that isn't explicitly 'development' (production, test,
		// staging, or NODE_ENV unset entirely) gets the safe, non-leaky
		// response. Previously this was an `else if (NODE_ENV === 'production')`
		// with no fallback — any other value silently sent no response at
		// all, hanging the request forever.
		const error = { ...err, message };

		if (err.code === 11000) {
			const msg = err.message.split(':');
			error.message = `Duplicate value, for ${msg[4].replace('}', '')}`;
			error.isOperational = true;
		}
		if (err.name === 'TokenExpiredError') {
			error.isOperational = true;
			error.message =
				'Login expired! Login to refresh you authentication session';
		}
		if (err.name === 'JsonWebTokenError') {
			error.isOperational = true;
			error.message = 'Invalid login token, please login again';
		}
		if (err.name === 'ValidationError') {
			error.message = err.message.split(':')[2];
			error.isOperational = true;
		}
		if (err.name === 'CastError' && err?.path === '_id') {
			error.isOperational = true;
			error.message = 'Invalid Student Code';
		}

		sendErrorProd(error, statusCode, res);
	}
};
