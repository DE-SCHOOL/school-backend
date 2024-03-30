const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'You must define a question'],
	},
	answers: {
		type: Array,
		required: [true, 'A question must have options of answers'],
	},
	category: {
		type: mongoose.Types.ObjectId,
		ref: 'question_category',
		required: [true, 'A question must belong to a category'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

questionSchema.pre(/^find/, function (next) {
	this.populate('category', 'name');

	next();
});

const Question = mongoose.model('question', questionSchema);

module.exports = Question;
