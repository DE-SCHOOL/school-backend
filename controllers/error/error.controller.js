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

module.exports = (err, req, res, next) => {
	const statusCode = err.statusCode ? err.statusCode : 500;
	const message = err.message ? err.message : 'Something went very wrong';

	if (process.env.NODE_ENV === 'development') {
		sendErrorDev(err, statusCode, res);
	} else if (process.env.NODE_ENV === 'production') {
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
		if (err.name === 'ValidationError') {
			error.message = err.message.split(':')[2];
			error.isOperational = true;
		}

		sendErrorProd(error, statusCode, res);
	}
};
