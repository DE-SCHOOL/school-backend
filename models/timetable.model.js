const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A timetable must have a name'],
	},
	level: {
		type: Number,
		required: [true, 'A timetable must belong to a level'],
	},
	downloadUrl: {
		type: String,
		required: [true, 'A timetable must have a download link'],
	},
	specialty: {
		type: mongoose.Types.ObjectId,
		ref: 'specialty',
		required: [true, 'A timetable must belong to a specialty'],
	},
	academicYear: {
		type: mongoose.Types.ObjectId,
		ref: 'academic_year',
		required: [true, 'A timetable must belong to an academic year'],
	},
	semester: {
		type: String,
		required: [true, 'A timetable must belong to a semester'],
	},
	createdAt: {
		type: Date,
		default: new Date().toISOString(),
	},
});

timetableSchema.pre(/^find/, function (next) {
	this.populate({ path: 'specialty', select: 'name' }).populate({
		path: 'academicYear',
		select: 'schoolYear',
	});

	next();
});

const Timetable = mongoose.model('timetable', timetableSchema);
module.exports = Timetable;
