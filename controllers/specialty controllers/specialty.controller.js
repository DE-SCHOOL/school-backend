const sendResponse = require('../../utilities/sendResponse');
const Specialty = require('./../../models/specialty.model');
const Course = require('./../../models/courses.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.createSpecialty = catchAsync(async (req, res, next) => {
	const { name, department } = req.body;

	const specialty = await Specialty.create({ name, department });

	if (!specialty) return next(new ErrorApi('Specialty not created', 400));

	sendResponse(res, 'success', 201, specialty);
});

exports.editSpecialty = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	const { name, department } = req.body;

	const specialty = await Specialty.findByIdAndUpdate(
		id,
		{ name, department },
		{ runValidators: true, new: true }
	);

	if (!specialty) return next(new ErrorApi('Specialty not found', 404));

	sendResponse(res, 'success', 200, specialty);
});

exports.getAllSpecialties = catchAsync(async (req, res, next) => {
	const specialties = await Specialty.find({});

	sendResponse(res, 'success', 200, specialties);
});

exports.getSpecialty = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const specialty = await Specialty.findById(id);

	if (!specialty) return next(new ErrorApi('No Specialty found', 404));

	sendResponse(res, 'success', 200, specialty);
});
