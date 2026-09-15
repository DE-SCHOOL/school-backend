const mongoose = require('mongoose');

// A school's billing relationship with the platform. Deliberately NOT
// run through tenantScope.plugin.js, same reasoning as school.model.js:
// this is managed by platform staff (a school upgrading its own plan
// without paying would be a real problem if school-side staff could
// write it directly), and the platform console needs to list/query
// subscriptions across every school with no single tenant context
// active. schoolId is still stored and indexed — just not auto-scoped.
//
// Plan tiers are named for Cameroonian school budgets specifically, not
// copied from a generic SaaS pricing template — see my-todo.md Stage 4
// for the reasoning. Price is in XAF (CFA franc), the real currency
// these schools operate in, not USD.
const subscriptionSchema = new mongoose.Schema({
	schoolId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'school',
		required: [true, 'A subscription must belong to a school'],
		unique: true,
		index: true,
	},
	plan: {
		type: String,
		enum: {
			values: ['starter', 'standard', 'premium'],
			message: 'Plan must be starter, standard, or premium',
		},
		required: [true, 'A subscription must have a plan'],
	},
	billingCycle: {
		type: String,
		enum: {
			values: ['monthly', 'annual'],
			message: 'Billing cycle must be monthly or annual',
		},
		required: [true, 'A subscription must have a billing cycle'],
	},
	status: {
		type: String,
		enum: {
			values: ['trialing', 'active', 'past_due', 'suspended', 'canceled'],
			message: 'Status must be trialing, active, past_due, suspended, or canceled',
		},
		default: 'trialing',
	},
	priceXAF: {
		type: Number,
		required: [true, 'A subscription must have a price'],
	},
	// Stage 6/7 payment methods — 'manual' covers the real day-one case
	// (a bank transfer or cash payment tracked by a human, before any
	// automated payment rail exists) rather than leaving this unset.
	paymentMethod: {
		type: String,
		enum: {
			values: ['manual', 'stellar', 'mtn_momo', 'orange_momo', 'card'],
			message: 'Invalid payment method',
		},
		default: 'manual',
	},
	currentPeriodStart: {
		type: Date,
		default: Date.now,
	},
	currentPeriodEnd: {
		type: Date,
	},
	// Set once a school opts in to on-chain billing via
	// utilities/stellar/soroban.js's createOnChainSubscription — the id
	// the real, deployed contracts/subscription-billing contract
	// returned for this subscription. Null until then; on-chain billing
	// is opt-in, not required (see soroban.js's own header comment for
	// why classic Stellar stays the default path).
	onChainSubscriptionId: {
		type: String,
		default: null,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const Subscription = mongoose.model('subscription', subscriptionSchema);
module.exports = Subscription;
