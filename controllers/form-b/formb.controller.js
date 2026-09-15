const sendResponse = require('./../../utilities/sendResponse');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');
const FormB = require('./../../models/formb.model');

exports.createFormB = catchAsync(async (req, res, next) => {
	const { name, level, specialty, academicYear, downloadUrl } = req.body;

	const formB = await FormB.create({
		name,
		level,
		specialty,
		academicYear,
		downloadUrl,
	});

	sendResponse(res, 'success', 201, formB);
});

exports.getAllFormBs = catchAsync(async (req, res, next) => {
	const formBs = await FormB.find({}).sort({ level: -1 });

	sendResponse(res, 'success', 200, formBs);
});

exports.deleteFormB = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const formBs = await FormB.deleteOne({ _id: id });

	sendResponse(res, 'success', 200, formBs);
});
