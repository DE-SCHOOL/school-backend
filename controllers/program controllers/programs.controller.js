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
