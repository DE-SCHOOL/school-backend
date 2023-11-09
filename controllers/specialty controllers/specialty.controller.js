const sendResponse = require('../../utilities/sendResponse');
const Specialty = require('./../../models/specialty.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.createSpecialty = catchAsync(async (req, res, next) => {
	const { name, department } = req.body;

	const specialty = await Specialty.create({ name, department });

	if (!specialty) return next(new ErrorApi('Specialty not created', 400));

	sendResponse(res, 'success', 201, specialty);
});

exports.getAllSpecialties = catchAsync(async (req, res, next) => {
	const specialties = await Specialty.find({});

	sendResponse(res, 'success', 200, specialties);
});
