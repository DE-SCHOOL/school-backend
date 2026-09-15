const mongoose = require('mongoose');
const tenantScope = require('../utilities/tenantScope.plugin');

const canteenItemSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'A canteen item must have a name'],
	},
	priceXAF: {
		type: Number,
		required: [true, 'A canteen item must have a price'],
		min: [0, 'Price cannot be negative'],
	},
	available: {
		type: Boolean,
		default: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

canteenItemSchema.plugin(tenantScope);

const CanteenItem = mongoose.model('canteen_item', canteenItemSchema);
module.exports = CanteenItem;
