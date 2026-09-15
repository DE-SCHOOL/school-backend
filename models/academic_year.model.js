const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

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

academicYearSchema.plugin(tenantScope);
// Was a lone `unique: true` on schoolYear — every school has a "2024/2025"
// year, so global uniqueness would let only one school in the whole
// platform ever use that string. Scoped to (schoolId, schoolYear).
academicYearSchema.index({ schoolId: 1, schoolYear: 1 }, { unique: true });

const AcademicYear = mongoose.model('academic_year', academicYearSchema);

module.exports = AcademicYear;
