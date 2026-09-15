const Invoice = require('../../models/invoice.model');
const Student = require('../../models/students.model');
const CanteenAccount = require('../../models/canteen_account.model');
const CanteenItem = require('../../models/canteen_item.model');
const CanteenTransaction = require('../../models/canteen_transaction.model');
const walletService = require('../../utilities/stellar/walletService');
const paymentService = require('../../utilities/stellar/paymentService');
const { xafToUsdc } = require('../../utilities/stellar/fxRate');
const { hasEntitlement } = require('../../utilities/entitlements');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

async function assertOwnEnrollment(personId, studentId) {
	const student = await Student.findById(studentId).setOptions({ skipTenantScope: true });
	if (!student || !student.personId || String(student.personId) !== String(personId)) {
		return null;
	}
	return student;
}

// Person-authenticated: a student/parent topping up their own canteen
// balance. Same Invoice + Stellar-payment mechanism as fee payments,
// just type: 'canteen_topup' — reconciliation (paymentService.js's
// applyCanteenTopUp) is what actually credits CanteenAccount once the
// payment is detected, not this endpoint directly.
//
// Entitlement-checked explicitly here, not via
// utilities/entitlements.js's requireEntitlement middleware — that
// middleware reads the ambient tenant context (tenantContext.getSchoolId()),
// which only exists for staff/student requests that went through
// authController.protect. A Person isn't scoped to any one school
// (Stage 5), so there's no ambient context for it to read here; the
// school this check is actually about is only known once the target
// student's enrollment is resolved, one line below.
exports.createTopUpInvoice = catchAsync(async (req, res, next) => {
	const { studentId, amountXAF } = req.body;
	if (!studentId || !amountXAF) {
		return next(new ErrorApi('studentId and amountXAF are required', 400));
	}

	const student = await assertOwnEnrollment(req.person._id, studentId);
	if (!student) return next(new ErrorApi('This is not one of your own linked enrollments', 403));

	if (!(await hasEntitlement(student.schoolId, 'canteen'))) {
		return next(new ErrorApi("This school's plan does not include the canteen feature", 403));
	}

	const invoice = await Invoice.create({
		schoolId: student.schoolId,
		type: 'canteen_topup',
		studentId,
		description: 'Canteen balance top-up',
		amountXAF,
		amountUsdc: xafToUsdc(amountXAF),
	});

	const schoolWallet = await walletService.getOrCreateWallet('school', student.schoolId);

	sendResponse(res, 'success', 201, {
		invoice,
		paymentUri:
			schoolWallet.status === 'active'
				? paymentService.paymentUri({
						destinationPublicKey: schoolWallet.publicKey,
						amountUsdc: invoice.amountUsdc,
						memo: invoice.memo,
				  })
				: null,
	});
});

exports.getMyCanteenBalance = catchAsync(async (req, res, next) => {
	const student = await assertOwnEnrollment(req.person._id, req.params.studentId);
	if (!student) return next(new ErrorApi('This is not one of your own linked enrollments', 403));

	const account = await CanteenAccount.findOne({
		schoolId: student.schoolId,
		studentId: student._id,
	}).setOptions({ skipTenantScope: true });

	sendResponse(res, 'success', 200, { balanceXAF: account?.balanceXAF || 0 });
});

// School-staff-facing point of sale. Deliberately a single, fast,
// all-or-nothing balance check + deduction (no per-item Stellar
// round-trip — see canteen_account.model.js's own comment on why this
// ledger is off-chain) so a lunch-rush line doesn't stall on network
// latency. TO_ALL_OFFICE_STAFF + entitlement-gated at the route level.
exports.purchase = catchAsync(async (req, res, next) => {
	const { studentId, items } = req.body;
	if (!studentId || !Array.isArray(items) || items.length === 0) {
		return next(new ErrorApi('studentId and a non-empty items array are required', 400));
	}

	const itemIds = items.map((i) => i.canteenItemId);
	const canteenItems = await CanteenItem.find({ _id: { $in: itemIds } });
	const itemsById = new Map(canteenItems.map((i) => [String(i._id), i]));

	let total = 0;
	const lineItems = items.map(({ canteenItemId, qty }) => {
		const item = itemsById.get(String(canteenItemId));
		if (!item || !item.available) {
			throw new ErrorApi(`Item ${canteenItemId} is not available`, 400);
		}
		total += item.priceXAF * qty;
		return { canteenItemId: item._id, name: item.name, priceXAF: item.priceXAF, qty };
	});

	const account = await CanteenAccount.findOne({ studentId });
	if (!account || account.balanceXAF < total) {
		return next(new ErrorApi('Insufficient canteen balance', 402));
	}

	account.balanceXAF -= total;
	await account.save();

	const transaction = await CanteenTransaction.create({
		studentId,
		type: 'purchase',
		amountXAF: total,
		items: lineItems,
		balanceAfter: account.balanceXAF,
	});

	sendResponse(res, 'success', 201, transaction);
});

exports.getLedger = catchAsync(async (req, res, next) => {
	const transactions = await CanteenTransaction.find({ studentId: req.params.studentId }).sort({
		createdAt: -1,
	});
	sendResponse(res, 'success', 200, transactions);
});
