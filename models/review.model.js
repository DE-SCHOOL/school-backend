const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
	program: {
		type: mongoose.Types.ObjectId,
		ref: 'program',
		required: [true, 'A review must belong to a program'],
	},
	question: {
		type: mongoose.Types.ObjectId,
		ref: 'question',
		required: [true, 'A review must be done on a question'],
	},
	course: {
		type: mongoose.Types.ObjectId,
		ref: 'course',
		required: [true, 'A review must belong to a course'],
	},
	response: {
		type: String,
		required: [true, 'There must be a review'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

reviewSchema.pre(/^find/, function (next) {
	this.populate('question', 'name');

	next();
});

const Review = mongoose.model('review', reviewSchema);

module.exports = Review;
