const Subscription = require('../models/subscription.model');
const ErrorApi = require('./ErrorApi');
const tenantContext = require('./tenantContext');

// Which plans a feature is available on. Deliberately a plain object,
// not a database collection — these are product/pricing decisions made
// by editing code and deploying, the same way route definitions are,
// not something any UI needs to change at runtime yet. Feature keys
// match the ones named in my-todo.md Stage 4: canteen (Stage 8),
// stellar_payments (Stage 6), sms_notifications (not yet built).
const FEATURE_PLANS = {
	canteen: ['standard', 'premium'],
	stellar_payments: ['standard', 'premium'],
	sms_notifications: ['premium'],
};

async function hasEntitlement(schoolId, featureKey) {
	const allowedPlans = FEATURE_PLANS[featureKey];

	if (!allowedPlans) {
		throw new Error(`Unknown entitlement feature key: ${featureKey}`);
	}

	const subscription = await Subscription.findOne({ schoolId });

	if (!subscription || subscription.status !== 'active') {
		return false;
	}

	return allowedPlans.includes(subscription.plan);
}

// Express middleware — checks the *current request's* tenant (set by
// authController.protect) against FEATURE_PLANS. Not wired onto any
// route yet: nothing built so far (Stages 1-5) is a paid-tier feature.
// This exists now, correctly implemented and exported, for Stage 6/8 to
// apply to Stellar/canteen routes directly rather than each reinventing
// its own plan check.
function requireEntitlement(featureKey) {
	return async (req, res, next) => {
		const schoolId = tenantContext.getSchoolId();

		if (!schoolId) {
			return next(
				new ErrorApi(
					'requireEntitlement() was used outside an active tenant context',
					500
				)
			);
		}

		const allowed = await hasEntitlement(schoolId, featureKey);

		if (!allowed) {
			return next(
				new ErrorApi(
					`This feature (${featureKey}) is not included in your school's current plan`,
					403
				)
			);
		}

		next();
	};
}

module.exports = { FEATURE_PLANS, hasEntitlement, requireEntitlement };
