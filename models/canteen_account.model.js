const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

// One per student per school — an off-chain spendable balance, credited
// by reconciled Stellar top-up payments (see
// utilities/stellar/paymentService.js's applyCanteenTopUp) and debited
// by canteen purchases (canteen.controller.js). Deliberately off-chain:
// a lunch-rush point-of-sale needs to deduct in real time without
// waiting ~5s for Stellar ledger confirmation on every single purchase
// (my-todo.md Stage 8's own note) — the blockchain settles the top-up,
// not each individual purchase.
const canteenAccountSchema = new mongoose.Schema({
	studentId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'student',
		required: [true, 'A canteen account must belong to a student'],
	},
	balanceXAF: {
		type: Number,
		default: 0,
		min: [0, 'Canteen balance cannot go negative'],
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

canteenAccountSchema.plugin(tenantScope);
canteenAccountSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });

canteenAccountSchema.pre('save', function () {
	this.updatedAt = new Date();
});

const CanteenAccount = mongoose.model('canteen_account', canteenAccountSchema);
module.exports = CanteenAccount;
