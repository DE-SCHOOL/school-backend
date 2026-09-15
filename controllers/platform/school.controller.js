const mongoose = require('mongoose');
const School = require('../../models/school.model');
const Staff = require('../../models/staff.model');
const Subscription = require('../../models/subscription.model');
const DemoRequest = require('../../models/demo_request.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

// Starting point only — not researched Cameroonian market pricing, a
// deliberately simple default so createSchool never has to run without
// *some* price on record. Real numbers are a BIZ decision (my-todo.md
// Stage 4/11) platformStaff should override per school via
// setSubscription below, not something this code can respectably invent.
const DEFAULT_MONTHLY_PRICE_XAF = {
	starter: 15000,
	standard: 35000,
	premium: 75000,
};

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
	const {
		name,
		slug,
		contactEmail,
		contactPhone,
		address,
		poBox,
		region,
		country,
		motto,
		ministry,
		firstAdmin,
		plan,
		billingCycle,
		demoRequestId,
	} = req.body;

	if (!firstAdmin) {
		return next(
			new ErrorApi('firstAdmin (the school\'s first staff admin) is required', 400)
		);
	}

	const resolvedPlan = plan || 'starter';
	if (!DEFAULT_MONTHLY_PRICE_XAF[resolvedPlan]) {
		return next(new ErrorApi('Invalid plan', 400));
	}
	const resolvedBillingCycle = billingCycle || 'monthly';

	const session = await mongoose.startSession();
	let school;

	try {
		await session.withTransaction(async () => {
			const created = await School.create(
				[{ name, slug, contactEmail, contactPhone, address, poBox, region, country, motto, ministry }],
				{ session }
			);
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

			const monthlyPrice = DEFAULT_MONTHLY_PRICE_XAF[resolvedPlan];
			await Subscription.create(
				[
					{
						schoolId: school._id,
						plan: resolvedPlan,
						billingCycle: resolvedBillingCycle,
						priceXAF:
							resolvedBillingCycle === 'annual'
								? monthlyPrice * 12
								: monthlyPrice,
					},
				],
				{ session }
			);

			// Converting a lead is an explicit, opt-in step (a real
			// demoRequestId has to be passed) — createSchool never silently
			// auto-closes a lead just because a School with a similar name
			// happened to get created.
			if (demoRequestId) {
				const demoRequest = await DemoRequest.findByIdAndUpdate(
					demoRequestId,
					{ status: 'active', schoolId: school._id },
					{ new: true, runValidators: true, session }
				);
				if (!demoRequest) {
					throw new ErrorApi('demoRequestId does not match any demo request', 400);
				}
			}
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

exports.getSubscription = catchAsync(async (req, res, next) => {
	const subscription = await Subscription.findOne({ schoolId: req.params.id });

	if (!subscription) return next(new ErrorApi('No subscription found for this school', 404));

	sendResponse(res, 'success', 200, subscription);
});

// Plan changes, billing-cycle changes, suspensions for non-payment,
// switching payment method — all platform-only, deliberately: a school
// changing its own billing status is exactly the self-upgrade-without-
// paying risk subscription.model.js's own comment describes.
exports.updateSubscription = catchAsync(async (req, res, next) => {
	const { plan, billingCycle, status, paymentMethod, priceXAF } = req.body;

	const update = {};
	if (plan) update.plan = plan;
	if (billingCycle) update.billingCycle = billingCycle;
	if (status) update.status = status;
	if (paymentMethod) update.paymentMethod = paymentMethod;
	if (priceXAF !== undefined) update.priceXAF = priceXAF;

	const subscription = await Subscription.findOneAndUpdate(
		{ schoolId: req.params.id },
		update,
		{ new: true, runValidators: true }
	);

	if (!subscription) return next(new ErrorApi('No subscription found for this school', 404));

	sendResponse(res, 'success', 200, subscription);
});
