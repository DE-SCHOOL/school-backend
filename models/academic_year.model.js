const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema({
	schoolYear: {
		type: String,
		required: [true, 'You Must Choose and Academic Year'],
		validate: {
			validator: function (val) {
				return val.length === 9;
			},
			message: 'School Year must be 9 characters e.g yyyy/yyyy',
		},
		unique: true,
	},
	createdAt: {
		type: Date,
		default: Date.now(),
	},
	isCurrent: {
		type: Boolean,
		default: false,
		required: [
			true,
			'Each year must have a state of current which should be true or false',
		],
	},
});

const AcademicYear = mongoose.model('academic_year', academicYearSchema);

module.exports = AcademicYear;
