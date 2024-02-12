const sendResponse = (res, status, statusCode, data) => {
	res.status(statusCode).json({
		status,
		results: data?.length,
		data,
	});
};

module.exports = sendResponse;
