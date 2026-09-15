const Invoice = require('../../models/invoice.model');
const Subscription = require('../../models/subscription.model');
const StellarWallet = require('../../models/stellar_wallet.model');
const walletService = require('../../utilities/stellar/walletService');
const paymentService = require('../../utilities/stellar/paymentService');
const soroban = require('../../utilities/stellar/soroban');
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
	const wallet = await StellarWallet.findOne({
		ownerType: 'platform',
		ownerId: walletService.PLATFORM_OWNER_ID,
	}).select('+encryptedSecret');

	if (!wallet || wallet.status !== 'active') {
		return next(new ErrorApi('Platform wallet is not active yet', 400));
	}

	const { newlyPaidInvoices, recordedPayments } = await paymentService.reconcileAndApply(wallet);

	sendResponse(res, 'success', 200, {
		newlyPaidInvoiceIds: newlyPaidInvoices.map((i) => i._id),
		paymentsRecorded: recordedPayments.length,
	});
});

// --- On-chain billing (contracts/subscription-billing), opt-in — see
// utilities/stellar/soroban.js's own header comment for why this is
// offered alongside classic billing above, not replacing it. ---

// TO_MAIN_ADMIN (school's own admin, not platform) — a school opts
// itself into on-chain billing; the platform doesn't do this on a
// school's behalf, since it's the school's own wallet that will be
// signing every future on-chain `pay` call.
exports.registerOnChainSubscription = catchAsync(async (req, res, next) => {
	const subscription = await Subscription.findOne({ schoolId: req.staff.schoolId });
	if (!subscription) return next(new ErrorApi('No subscription found for this school', 404));
	if (subscription.onChainSubscriptionId) {
		return next(new ErrorApi('This subscription is already registered on-chain', 400));
	}

	const schoolWallet = await StellarWallet.findOne({
		ownerType: 'school',
		ownerId: req.staff.schoolId,
	}).select('+encryptedSecret');
	if (!schoolWallet || schoolWallet.status !== 'active') {
		return next(new ErrorApi('School wallet is not active yet', 400));
	}

	const platformWallet = await walletService.getOrCreatePlatformWallet();
	if (platformWallet.status !== 'active') {
		return next(new ErrorApi('Platform treasury wallet is not active yet', 400));
	}

	const onChainId = await soroban.createOnChainSubscription({
		schoolWallet,
		treasuryPublicKey: platformWallet.publicKey,
		usdcContractId: process.env.SOROBAN_USDC_CONTRACT_ID,
		amountUsdc: xafToUsdc(subscription.priceXAF),
		periodSeconds: subscription.billingCycle === 'annual' ? 365 * 24 * 60 * 60 : 30 * 24 * 60 * 60,
		plan: subscription.plan,
	});

	subscription.onChainSubscriptionId = String(onChainId);
	await subscription.save();

	sendResponse(res, 'success', 200, { onChainSubscriptionId: subscription.onChainSubscriptionId });
});

// TO_MAIN_ADMIN — settles one on-chain billing period. This call itself
// IS the payment: the school's own (custodial) wallet signs a real
// Soroban transaction that transfers real USDC to the platform
// treasury, executed by the contract, not by this backend directly.
exports.payOnChainSubscription = catchAsync(async (req, res, next) => {
	const subscription = await Subscription.findOne({ schoolId: req.staff.schoolId });
	if (!subscription || !subscription.onChainSubscriptionId) {
		return next(new ErrorApi('This subscription is not registered on-chain', 400));
	}

	const schoolWallet = await StellarWallet.findOne({
		ownerType: 'school',
		ownerId: req.staff.schoolId,
	}).select('+encryptedSecret');

	const nextDue = await soroban.payOnChain(schoolWallet, subscription.onChainSubscriptionId);

	subscription.status = 'active';
	subscription.currentPeriodEnd = new Date(Number(nextDue) * 1000);
	await subscription.save();

	sendResponse(res, 'success', 200, { nextDueAt: subscription.currentPeriodEnd });
});

// TO_ALL_OFFICE_STAFF — read-only, public information by design (see
// soroban.js's own comment): reads the real on-chain billing status
// straight from the deployed contract, not this app's own database.
exports.getOnChainSubscriptionStatus = catchAsync(async (req, res, next) => {
	const subscription = await Subscription.findOne({ schoolId: req.staff.schoolId });
	if (!subscription || !subscription.onChainSubscriptionId) {
		return next(new ErrorApi('This subscription is not registered on-chain', 400));
	}

	const schoolWallet = await StellarWallet.findOne({
		ownerType: 'school',
		ownerId: req.staff.schoolId,
	}).select('+encryptedSecret');

	// Sequential, not Promise.all — both calls submit a real transaction
	// signed by the SAME school-wallet account, and Stellar accounts have
	// a single, strictly incrementing sequence number. Running them
	// concurrently races on that sequence number (found for real: this
	// threw a genuine RPC-level TRY_AGAIN_LATER, not a mock artifact).
	// Any future addition here that signs with the same account needs
	// the same discipline, not just these two calls.
	const isCurrent = await soroban.isCurrentOnChain(schoolWallet, subscription.onChainSubscriptionId);
	const record = await soroban.getOnChainSubscription(schoolWallet, subscription.onChainSubscriptionId);

	sendResponse(res, 'success', 200, {
		onChainSubscriptionId: subscription.onChainSubscriptionId,
		isCurrent,
		record,
	});
});
