const mongoose = require('mongoose');
const School = require('../../models/school.model');
const Staff = require('../../models/staff.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

// Replaces the old, unauthenticated `POST /api/v1/staff/register` route
// (no `protect` at all — "ONLY FOR DEV" per its own comment, but live in
// production with no auth check, meaning anyone on the internet could
// create an arbitrary admin-role staff account). Provisioning a school's
// first admin is now a platform-super-admin-only action that creates
// both the School and its first Staff admin in one atomic-ish step.
//
// The created Staff document's schoolId is set explicitly here, before
// tenantScope's pre('validate') hook runs — since this whole request
// runs with no active tenant context (there IS no tenant yet), that's
// the one legitimate way a new tenant-owned document gets created
// without an ambient AsyncLocalStorage context. See
// utilities/tenantScope.plugin.js's own comments for why that's safe.
exports.createSchool = catchAsync(async (req, res, next) => {
	const { name, slug, contactEmail, contactPhone, address, firstAdmin } =
		req.body;

	if (!firstAdmin) {
		return next(
			new ErrorApi('firstAdmin (the school\'s first staff admin) is required', 400)
		);
	}

	const session = await mongoose.startSession();
	let school;

	try {
		await session.withTransaction(async () => {
			const created = await School.create([{ name, slug, contactEmail, contactPhone, address }], {
				session,
			});
			school = created[0];

			await Staff.create(
				[
					{
						...firstAdmin,
						role: 'admin',
						schoolId: school._id,
					},
				],
				{ session }
			);
		});
	} finally {
		await session.endSession();
	}

	sendResponse(res, 'success', 201, school);
});

// No .setOptions({ skipTenantScope: true }) needed on any School query
// below — unlike every other model in models/, school.model.js never has
// tenantScope.plugin applied to it at all (a school can't belong to a
// school), so there's no scoping hook here to opt out of in the first
// place.
exports.getAllSchools = catchAsync(async (req, res, next) => {
	const schools = await School.find({});
	sendResponse(res, 'success', 200, schools);
});

exports.getSchool = catchAsync(async (req, res, next) => {
	const school = await School.findById(req.params.id);

	if (!school) return next(new ErrorApi('School not found', 404));

	sendResponse(res, 'success', 200, school);
});

exports.setSchoolStatus = catchAsync(async (req, res, next) => {
	const { status } = req.body;

	if (!['pending', 'active', 'suspended'].includes(status)) {
		return next(new ErrorApi('Invalid status', 400));
	}

	const school = await School.findByIdAndUpdate(
		req.params.id,
		{ status },
		{ new: true, runValidators: true }
	);

	if (!school) return next(new ErrorApi('School not found', 404));

	sendResponse(res, 'success', 200, school);
});
