const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema({
	name: {
		type: String,
		unique: true, //[true, 'specialty name should be unique'] ---> change and see if this will apply in case of an error
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

specialtySchema.pre(/^find/, function (next) {
	this.populate('department', 'name');

	next();
});

const Specialty = mongoose.model('specialty', specialtySchema);
module.exports = Specialty;
