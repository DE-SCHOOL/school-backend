const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');
const Review = require('./../../models/review.model');

exports.createReview = catchAsync(async (req, res, next) => {
	const { question, course, response } = req.body;

	const review = await Review.create({ question, course, response });

	sendResponse(res, 'success', 201, review);
});

exports.createManyReviews = catchAsync(async (req, res, next) => {
	const { question, course, response, school } = req.body;

	let reviews = [];
	for (let i = 0; i < question.length; i++) {
		reviews[i] = await Review.create({
			question: question[i],
			course,
			program: school,
			response: response[i],
		});
	}

	sendResponse(res, 'success', 201, reviews);
});

exports.getAllReview = catchAsync(async (req, res, next) => {
	const reviews = await Review.find({});

	sendResponse(res, 'success', 201, reviews);
});

exports.getReview = catchAsync(async (req, res, next) => {
	const { reviewID } = req.params;

	const review = await Review.findById(reviewID);

	sendResponse(res, 'success', 200, review);
});
