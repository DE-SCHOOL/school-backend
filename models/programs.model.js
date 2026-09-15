const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');
// const validator = require('validator');

//program should have email?
//two fields referencing one table (director and deputy director)

const programSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A program must have a name'],
	},
	director: {
		type: mongoose.Types.ObjectId,
		ref: 'staff',
		required: [true, 'A director must be the head of a program'],
	},
	deputyDirector: {
		type: mongoose.Types.ObjectId,
		ref: 'staff',
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

programSchema.plugin(tenantScope);
// Was a lone `unique: true` on name — scoped to (schoolId, name).
programSchema.index({ schoolId: 1, name: 1 }, { unique: true });

programSchema.pre(/^find/, function () {
	this.populate('director deputyDirector', 'name');
});
const Program = mongoose.model('program', programSchema);
module.exports = Program;
