const mongoose = require('mongoose');

const questionCatSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A category must have a name'],
		unique: true,
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

const QuestionCategory = mongoose.model('question_category', questionCatSchema);

module.exports = QuestionCategory;
