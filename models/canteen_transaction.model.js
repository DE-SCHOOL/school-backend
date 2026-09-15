const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

// The canteen's own ledger — every top-up and every purchase, in order,
// each carrying balanceAfter. This is the real audit trail Stage 6.5
// asks for ("on-chain transaction history/receipts... a genuine
// advantage over opaque mobile-money statements") for the off-chain
// half of the flow; the on-chain half is already fully visible via each
// top-up Invoice's own `payments[]` array (real Stellar tx hashes).
const canteenTransactionSchema = new mongoose.Schema({
	studentId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'student',
		required: [true, 'A canteen transaction must belong to a student'],
	},
	type: {
		type: String,
		enum: {
			values: ['topup', 'purchase'],
			message: 'type must be topup or purchase',
		},
		required: [true, 'A canteen transaction must have a type'],
	},
	amountXAF: {
		type: Number,
		required: [true, 'A canteen transaction must have an amount'],
	},
	items: [
		{
			canteenItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'canteen_item' },
			name: String,
			priceXAF: Number,
			qty: Number,
		},
	],
	balanceAfter: {
		type: Number,
		required: [true, 'A canteen transaction must record the resulting balance'],
	},
	relatedInvoiceId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'invoice',
		default: null,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

canteenTransactionSchema.plugin(tenantScope);

const CanteenTransaction = mongoose.model('canteen_transaction', canteenTransactionSchema);
module.exports = CanteenTransaction;
