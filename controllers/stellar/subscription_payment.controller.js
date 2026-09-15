const Invoice = require('../../models/invoice.model');
const Subscription = require('../../models/subscription.model');
const walletService = require('../../utilities/stellar/walletService');
const paymentService = require('../../utilities/stellar/paymentService');
const { xafToUsdc } = require('../../utilities/stellar/fxRate');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

// Platform-super-admin-only, mirroring school.controller.js's own
// pattern — generates the next billing invoice for a school's
// subscription, priced from the Subscription record's own priceXAF
// (not re-derived from the plan default, since a school may have a
// manually negotiated price via school.controller.js's updateSubscription).
exports.createSubscriptionInvoice = catchAsync(async (req, res, next) => {
	const subscription = await Subscription.findOne({ schoolId: req.params.schoolId });
	if (!subscription) return next(new ErrorApi('No subscription found for this school', 404));

	const invoice = await Invoice.create({
		schoolId: subscription.schoolId,
		type: 'subscription',
		description: `${subscription.plan} plan — ${subscription.billingCycle} billing`,
		amountXAF: subscription.priceXAF,
		amountUsdc: xafToUsdc(subscription.priceXAF),
		dueDate: subscription.currentPeriodEnd,
	});

	const platformWallet = await walletService.getOrCreatePlatformWallet();

	sendResponse(res, 'success', 201, {
		invoice,
		paymentUri:
			platformWallet.status === 'active'
				? paymentService.paymentUri({
						destinationPublicKey: platformWallet.publicKey,
						amountUsdc: invoice.amountUsdc,
						memo: invoice.memo,
				  })
				: null,
	});
});

exports.getSchoolSubscriptionInvoices = catchAsync(async (req, res, next) => {
	const invoices = await Invoice.find({ type: 'subscription' });
	sendResponse(res, 'success', 200, invoices);
});

// Platform-only — reconciles the ONE platform treasury wallet, which
// receives subscription payments from every school at once. This is
// exactly the cross-tenant case tenantScope.plugin.js's skipTenantScope
// escape hatch exists for: paymentService.js looks up each payment's
// matching Invoice by memo alone, with no way to know in advance which
// school it belongs to.
exports.reconcilePlatformWallet = catchAsync(async (req, res, next) => {
	const wallet = await require('../../models/stellar_wallet.model')
		.findOne({ ownerType: 'platform', ownerId: walletService.PLATFORM_OWNER_ID })
		.select('+encryptedSecret');

	if (!wallet || wallet.status !== 'active') {
		return next(new ErrorApi('Platform wallet is not active yet', 400));
	}

	const { newlyPaidInvoices, recordedPayments } = await paymentService.reconcileAndApply(wallet);

	sendResponse(res, 'success', 200, {
		newlyPaidInvoiceIds: newlyPaidInvoices.map((i) => i._id),
		paymentsRecorded: recordedPayments.length,
	});
});
