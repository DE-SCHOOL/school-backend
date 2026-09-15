const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

const questionCatSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A category must have a name'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

questionCatSchema.plugin(tenantScope);
// Was a lone `unique: true` on name — scoped to (schoolId, name).
questionCatSchema.index({ schoolId: 1, name: 1 }, { unique: true });

const QuestionCategory = mongoose.model('question_category', questionCatSchema);

module.exports = QuestionCategory;
