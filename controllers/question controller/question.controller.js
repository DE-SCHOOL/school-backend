const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Question = require('./../../models/question.model');

exports.createQuestion = catchAsync(async (req, res, next) => {
	const { name, category, answers } = req.body;

	const question = await Question.create({ name, category, answers });

	sendResponse(res, 'success', 201, question);
});

exports.getAllQuestions = catchAsync(async (req, res, next) => {
	const questions = await Question.find({});

	sendResponse(res, 'success', 200, questions);
});

exports.getQuestion = catchAsync(async (req, res, next) => {
	const { questionID } = req.params;

	const question = await Question.findById(questionID);

	if (!question) return next(new ErrorApi('No such question', 400));

	sendResponse(res, 'success', 200, question);
});

exports.editQuestion = catchAsync(async (req, res, next) => {
	const { questionID } = req.params;
	const { name, answers, category } = req.body;

	const question = await Question.findByIdAndUpdate(
		questionID,
		{
			name,
			answers,
			category,
		},
		{ returnOriginal: false }
	);

	sendResponse(res, 'success', 201, question);
});

exports.deleteQuestion = catchAsync(async (req, res, next) => {
	const { questionID } = req.params;

	const question = await Question.findByIdAndDelete(questionID, {
		returnOriginal: false,
	});

	if (!question) return next(new ErrorApi('No such question', 400));

	sendResponse(res, 'success', 204, question);
});
