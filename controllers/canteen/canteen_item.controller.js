const CanteenItem = require('../../models/canteen_item.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

exports.createItem = catchAsync(async (req, res, next) => {
	const { name, priceXAF, available } = req.body;

	const item = await CanteenItem.create({
		name,
		priceXAF,
		available: available !== undefined ? available : true,
	});

	sendResponse(res, 'success', 201, item);
});

exports.getAllItems = catchAsync(async (req, res, next) => {
	const items = await CanteenItem.find({});
	sendResponse(res, 'success', 200, items);
});

exports.editItem = catchAsync(async (req, res, next) => {
	const { name, priceXAF, available } = req.body;

	const item = await CanteenItem.findByIdAndUpdate(
		req.params.id,
		{ name, priceXAF, available },
		{ new: true, runValidators: true }
	);

	if (!item) return next(new ErrorApi('Canteen item not found', 404));

	sendResponse(res, 'success', 200, item);
});

exports.deleteItem = catchAsync(async (req, res, next) => {
	const item = await CanteenItem.findByIdAndDelete(req.params.id);
	if (!item) return next(new ErrorApi('Canteen item not found', 404));

	const items = await CanteenItem.find({});
	sendResponse(res, 'success', 200, items);
});
