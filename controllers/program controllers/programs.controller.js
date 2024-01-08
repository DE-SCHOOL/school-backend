const sendResponse = require('../../utilities/sendResponse');
const Program = require('./../../models/programs.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.createProgram = catchAsync(async (req, res, next) => {
	const { name, director, deputyDirector } = req.body;

	const program = await Program.create({ name, director, deputyDirector });

	if (!program) return next(new ErrorApi('Program not created', 400));

	sendResponse(res, 'success', 201, program);
});

exports.getPrograms = catchAsync(async (req, res, next) => {
	const programs = await Program.find({});

	sendResponse(res, 'success', 200, programs);
});

exports.getProgram = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const program = await Program.findById(id);

	if (!program) return next(new ErrorApi('No such program', 404));

	sendResponse(res, 'success', 200, program);
});

exports.editProgram = catchAsync(async (req, res, next) => {
	const { id } = req.params;
	const { name, director, deputyDirector } = req.body;

	const program = await Program.findByIdAndUpdate(
		id,
		{ name, director, deputyDirector },
		{ new: true, runValidators: true }
	);

	if (!program) return next(new ErrorApi('Program not created', 404));

	sendResponse(res, 'success', 200, program);
});
