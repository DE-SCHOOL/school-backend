const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const QuestionCategory = require('./../../models/question_category.model');

exports.createCategory = catchAsync(async (req, res, next) => {
	const { name } = req.body;

	const category = await QuestionCategory.create({ name });

	sendResponse(res, 'success', 201, category);
});

exports.getAllCategories = catchAsync(async (req, res, next) => {
	const categories = await QuestionCategory.find({});

	sendResponse(res, 'success', 200, categories);
});

exports.getCategory = catchAsync(async (req, res, next) => {
	const { catID } = req.params;

	const category = await QuestionCategory.findById(catID);

	if (!category) return next(new ErrorApi('No such category', 400));

	sendResponse(res, 'success', 200, category);
});

exports.editCategory = catchAsync(async (req, res, next) => {
	const { catID } = req.params;
	const { name } = req.body;

	const category = await QuestionCategory.findByIdAndUpdate(
		catID,
		{ name },
		{ new: true }
	);

	sendResponse(res, 'success', 201, category);
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
	const { catID } = req.params;

	const category = await QuestionCategory.findByIdAndDelete(catID, {
		new: true,
	});

	if (!category) return next(new ErrorApi('No such category', 400));

	sendResponse(res, 'success', 204, category);
});
