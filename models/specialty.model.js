const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

const specialtySchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Specialty name should be provided'],
	},
	department: {
		type: mongoose.Types.ObjectId,
		ref: 'department',
		required: [true, 'A specialty must belong to a department'],
	},
	level: {
		type: Number,
		enum: {
			values: [100, 200, 300, 400, 500, 601, 602],
			message: 'A class must either be 100, 200, 300, 400, 500, 601, or 602',
		},
		required: [true, 'A student must belong to a class'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

specialtySchema.plugin(tenantScope);
// Was a lone `unique: true` on name — scoped to (schoolId, name), same
// reasoning as department.model.js.
specialtySchema.index({ schoolId: 1, name: 1 }, { unique: true });

specialtySchema.pre(/^find/, function () {
	this.populate('department', 'name');
});

const Specialty = mongoose.model('specialty', specialtySchema);
module.exports = Specialty;
