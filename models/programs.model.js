const mongoose = require('mongoose');
// const validator = require('validator');

//program should have email?
//two fields referencing one table (director and deputy director)

const programSchema = new mongoose.Schema({
	name: {
		type: String,
		unique: true,
		required: [true, 'A program must have a name'],
	},
	director: {
		type: mongoose.Types.ObjectId,
		ref: 'Staff',
		required: [true, 'A director must be the head of a program'],
	},
	deputyDirector: {
		type: mongoose.Types.ObjectId,
		ref: 'Staff',
		required: [true, 'A program must have an assitant director'],
	},
	logo: {
		type: String,
		default: 'n/a',
		required: [true, 'A program should have a logo'],
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
});

const Program = mongoose.model('program', programSchema);
module.exports = Program;
