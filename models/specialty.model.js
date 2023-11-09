const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema({
	name: {
		type: String,
		unique: true, //[true, 'specialty name should be unique'] ---> change and see if this will apply in case of an error
		required: [true, 'Specialty name should be provided'],
	},
	department: {
		type: mongoose.Types.ObjectId,
		ref: 'Department',
		required: [true, 'A specialty must belong to a department'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

const Specialty = mongoose.model('specialty', specialtySchema);
module.exports = Specialty;
