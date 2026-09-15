const Invoice = require('../../models/invoice.model');
const { server } = require('./client');
const { usdcAsset, usdcIssuer } = require('./asset');

// SEP-0007-shaped payment URI (https://stellar.org/protocol/sep-7) —
// what a QR code encodes so any Stellar wallet app (Lobstr, Freighter,
// etc.) can prefill a payment to the right destination/asset/amount/
// memo without the payer typing any of it by hand. Real, standard,
// works with real wallet apps — not a bespoke format.
function paymentUri({ destinationPublicKey, amountUsdc, memo }) {
	const params = new URLSearchParams({
		destination: destinationPublicKey,
		amount: String(amountUsdc),
		asset_code: 'USDC',
		asset_issuer: usdcIssuer(),
		memo,
		memo_type: 'MEMO_TEXT',
	});
	return `web+stellar:pay?${params.toString()}`;
}

// Scans a wallet's recent incoming USDC payments and matches each one,
// by memo, against a pending/partially_paid Invoice — the actual
// reconciliation Stage 6.2's own spec asks for ("no manual 'mark as
// paid' step for the common case"). Idempotent: a payment whose
// transaction hash is already recorded against some invoice is skipped,
// so calling this repeatedly (there's no background job scheduler in
// this codebase yet — see this function's own callers) never
// double-counts a payment.
//
// USDC-only by design, not XLM — an invoice's amountUsdc is fixed at
// creation time specifically so the payer knows an exact figure to send
// (my-todo.md Stage 6.1's whole reasoning for USDC over XLM); matching
// a volatile-priced XLM payment against that same fixed figure would
// need its own live FX rate at receipt time, which utilities/stellar/
// fxRate.js's own comment already flags as not yet a real data source.
// XLM stays usable for account funding/reserves, just not invoice
// settlement, until that's built.
async function reconcileWalletPayments(wallet, { limit = 50 } = {}) {
	const issuer = usdcIssuer();
	const payments = await server
		.payments()
		.forAccount(wallet.publicKey)
		.order('desc')
		.limit(limit)
		.call();

	const newlyPaidInvoices = [];
	const recordedPayments = [];

	for (const record of payments.records) {
		if (record.type !== 'payment') continue;
		if (record.to !== wallet.publicKey) continue;
		if (record.asset_type === 'native') continue; // XLM — not matched, see comment above
		if (record.asset_code !== 'USDC' || record.asset_issuer !== issuer) continue;

		const alreadyRecorded = await Invoice.findOne({
			'payments.stellarTxHash': record.transaction_hash,
		}).setOptions({ skipTenantScope: true });
		if (alreadyRecorded) continue;

		// No active tenant context here by design — reconciliation runs
		// against one wallet's payment stream, which can (for the platform
		// treasury wallet) contain payments for invoices belonging to many
		// different schools. Which invoice/school this is is exactly what
		// the memo lookup below determines.
		const txRecord = await server.transactions().transaction(record.transaction_hash).call();
		const memo = txRecord.memo;
		if (!memo) continue;

		const invoice = await Invoice.findOne({
			memo,
			status: { $in: ['pending', 'partially_paid', 'overdue'] },
		}).setOptions({ skipTenantScope: true });
		if (!invoice) continue;

		invoice.payments.push({
			amountUsdc: Number(record.amount),
			stellarTxHash: record.transaction_hash,
			fromPublicKey: record.from,
		});

		const totalPaid = invoice.totalPaidUsdc();
		// A 1-stroop (0.0000001 USDC) tolerance, not exact equality — real,
		// found via this exact scenario in scripts/verify-stage-6-8.js:
		// splitting an invoice's amountUsdc in half for two installments,
		// then summing what actually landed on-chain, came up 0.0000001
		// short of the original figure due to Stellar's fixed-point amount
		// truncation on the split (40.9836066 requested, 40.9836065
		// actually settled, twice). Exact floating-point equality on a
		// financial total is never safe; the tolerance is intentionally
		// exactly one stroop — the smallest unit Stellar amounts can even
		// represent — not a wider fudge factor that could under-collect.
		const STROOP_TOLERANCE = 0.0000001;
		invoice.status = totalPaid >= invoice.amountUsdc - STROOP_TOLERANCE ? 'paid' : 'partially_paid';
		await invoice.save();

		recordedPayments.push({ invoiceId: invoice._id, amountUsdc: Number(record.amount) });
		if (invoice.status === 'paid') newlyPaidInvoices.push(invoice);
	}

	return { newlyPaidInvoices, recordedPayments };
}

// A school's wallet receives BOTH student_fee and canteen_topup
// invoices' payments, mixed together in one payment stream — reconciling
// from only one feature's controller (say, fee payments) and applying
// only that feature's side effects would silently strand a canteen
// top-up that happened to get paid in the same batch, marked 'paid' on
// its Invoice but never credited to the student's CanteenAccount. This
// is the single, shared entry point every caller (subscription
// controller, fee controller, canteen controller) uses instead, so
// "reconcile this wallet" and "apply what that reconciliation found"
// can never drift apart by which controller happened to be called first.
async function reconcileAndApply(wallet) {
	const { newlyPaidInvoices, recordedPayments } = await reconcileWalletPayments(wallet);

	for (const invoice of newlyPaidInvoices) {
		if (invoice.type === 'subscription') {
			await applySubscriptionPayment(invoice);
		} else if (invoice.type === 'canteen_topup') {
			await applyCanteenTopUp(invoice);
		}
		// 'student_fee' needs no further side effect — the paid Invoice
		// itself is the fee record; nothing else to update.
	}

	return { newlyPaidInvoices, recordedPayments };
}

async function applySubscriptionPayment(invoice) {
	const Subscription = require('../../models/subscription.model');
	const subscription = await Subscription.findOne({ schoolId: invoice.schoolId });
	if (!subscription) return; // invoice outlived its subscription somehow — nothing to extend

	const cycleMs =
		subscription.billingCycle === 'annual' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
	const base =
		subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()
			? subscription.currentPeriodEnd
			: new Date();

	subscription.currentPeriodStart = subscription.currentPeriodStart || new Date();
	subscription.currentPeriodEnd = new Date(base.getTime() + cycleMs);
	subscription.status = 'active';
	await subscription.save();
}

async function applyCanteenTopUp(invoice) {
	const CanteenAccount = require('../../models/canteen_account.model');
	const CanteenTransaction = require('../../models/canteen_transaction.model');

	let account = await CanteenAccount.findOne({
		schoolId: invoice.schoolId,
		studentId: invoice.studentId,
	}).setOptions({ skipTenantScope: true });

	if (!account) {
		account = new CanteenAccount({
			schoolId: invoice.schoolId,
			studentId: invoice.studentId,
			balanceXAF: 0,
		});
	}

	account.balanceXAF += invoice.amountXAF;
	account.$locals.skipTenantScope = true; // schoolId already set from the invoice, no ambient context here
	await account.save();

	const ledgerEntry = new CanteenTransaction({
		schoolId: invoice.schoolId,
		studentId: invoice.studentId,
		type: 'topup',
		amountXAF: invoice.amountXAF,
		balanceAfter: account.balanceXAF,
		relatedInvoiceId: invoice._id,
	});
	ledgerEntry.$locals.skipTenantScope = true;
	await ledgerEntry.save();
}

module.exports = { paymentUri, reconcileWalletPayments, reconcileAndApply };
