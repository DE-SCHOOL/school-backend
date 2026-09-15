const mongoose = require('mongoose');
const crypto = require('crypto');
const tenantScope = require('../utilities/tenantScope.plugin');

function generateMemo() {
	// Stellar MEMO_TEXT is capped at 28 bytes — kept well under that.
	return `inv-${crypto.randomBytes(6).toString('hex')}`;
}

// One Invoice model reused across subscription billing (Stage 6.2),
// student fees (Stage 6.3), and canteen top-ups (Stage 6.4/8) rather
// than three near-identical models — same total-owed/partial-payments/
// reconciliation shape in all three cases, just a different `type` and
// (for student_fee/canteen_topup) a studentId.
//
// Tenant-scoped (unlike School/Subscription/StellarWallet): once an
// invoice exists, it's real day-to-day data a school admin (or,
// eventually, a student via their own portal) needs to see within their
// own authenticated session — the platform-level "who do I bill"
// decision already happened at Subscription/DemoRequest creation time.
const invoiceSchema = new mongoose.Schema({
	type: {
		type: String,
		enum: {
			values: ['subscription', 'student_fee', 'canteen_topup'],
			message: 'type must be subscription, student_fee, or canteen_topup',
		},
		required: [true, 'An invoice must have a type'],
	},
	studentId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'student',
		default: null,
		// required only for student_fee/canteen_topup — enforced in
		// application code (invoiceService.js) rather than a Mongoose
		// conditional-required, since the condition depends on a sibling
		// field's value, which conditional validators handle awkwardly.
	},
	description: {
		type: String,
		required: [true, 'An invoice must have a description'],
	},
	amountXAF: {
		type: Number,
		required: [true, 'An invoice must have an amount in XAF'],
	},
	// Fixed at creation time, not computed on read — the payer needs to
	// know exactly how much USDC to send at the moment they're shown the
	// invoice, not a value that could drift if the XAF/USDC rate this
	// codebase uses changes later. See utilities/stellar/fxRate.js's own
	// comment on why that rate is a placeholder.
	amountUsdc: {
		type: Number,
		required: [true, 'An invoice must have a fixed USDC amount'],
	},
	// The Stellar payment memo that identifies this specific invoice —
	// what paymentService.js's reconciliation matches incoming payments
	// against. Unique platform-wide (not just per-school) since
	// reconciliation for subscription invoices runs against the single
	// platform treasury wallet, receiving payments from every school.
	memo: {
		type: String,
		required: true,
		unique: true,
		default: generateMemo,
	},
	payments: [
		{
			amountUsdc: { type: Number, required: true },
			stellarTxHash: { type: String, required: true },
			fromPublicKey: { type: String, required: true },
			paidAt: { type: Date, default: Date.now },
		},
	],
	status: {
		type: String,
		enum: {
			values: ['pending', 'partially_paid', 'paid', 'overdue', 'canceled'],
			message: 'Invalid invoice status',
		},
		default: 'pending',
	},
	dueDate: {
		type: Date,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

invoiceSchema.plugin(tenantScope);

invoiceSchema.methods.totalPaidUsdc = function () {
	return this.payments.reduce((sum, p) => sum + p.amountUsdc, 0);
};

const Invoice = mongoose.model('invoice', invoiceSchema);
module.exports = Invoice;
