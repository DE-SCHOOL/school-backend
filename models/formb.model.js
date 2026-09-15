const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

const formBSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "Form B's must have a name"],
	},
	level: {
		type: Number,
		required: [true, "Form B's must belong to a level"],
	},
	downloadUrl: {
		type: String,
		required: [true, "Form B's must have a download link"],
	},
	specialty: {
		type: mongoose.Types.ObjectId,
		ref: 'specialty',
		required: [true, "Form B's must belong to a specialty"],
	},
	academicYear: {
		type: mongoose.Types.ObjectId,
		ref: 'academic_year',
		required: [true, "Form B's must belong to an academic year"],
	},
	createdAt: {
		type: Date,
		default: new Date().toISOString(),
	},
});

formBSchema.plugin(tenantScope);

formBSchema.pre(/^find/, function () {
	this.populate({ path: 'specialty', select: 'name' }).populate({
		path: 'academicYear',
		select: 'schoolYear',
	});
});

const FormB = mongoose.model('form_b', formBSchema);
module.exports = FormB;
