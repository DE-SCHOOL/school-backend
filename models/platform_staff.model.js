const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

// Platform operators — the people running DE-SCHOOL itself, not any one
// school. Deliberately a separate collection from `staff`, not a `staff`
// row with schoolId: null: a super-admin approving new school signups
// (Stage 4) has nothing to do with any one school's staff roster, and
// keeping them separate means the tenantScope plugin's "every
// tenant-owned document has a schoolId" invariant stays simple and
// exceptionless rather than needing a null-schoolId special case
// threaded through every query.
const platformStaffSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Name must be provided'],
	},
	email: {
		type: String,
		unique: true,
		required: [true, 'Email address must be provided'],
		validate: [validator.isEmail, 'Invalid email provided'],
	},
	password: {
		type: String,
		minlength: [8, 'password should be atleast 8 characters'],
		required: [true, 'password is required'],
		select: false,
	},
	role: {
		type: String,
		required: [true, 'Each platform staff member must have a role'],
		enum: {
			values: ['super_admin', 'operations'],
			message: 'Role must be super_admin or operations',
		},
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

platformStaffSchema.pre('save', async function () {
	if (this.isNew || this.isModified('password')) {
		const saltRounds = 12;
		this.password = await bcrypt.hash(this.password, saltRounds);
	}
});

platformStaffSchema.methods.isPasswordCorrect = async function (
	plainPassword,
	hash
) {
	return bcrypt.compare(plainPassword, hash);
};

const PlatformStaff = mongoose.model('platform_staff', platformStaffSchema);
module.exports = PlatformStaff;
