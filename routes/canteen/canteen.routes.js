const express = require('express');
const authController = require('../../controllers/authentication/auth.controller');
const personController = require('../../controllers/person/person.controller');
const canteenItemController = require('../../controllers/canteen/canteen_item.controller');
const canteenController = require('../../controllers/canteen/canteen.controller');
const RIGHT = require('../../utilities/restrict');
const { requireEntitlement } = require('../../utilities/entitlements');

const router = express.Router();

// Every route in this file is entitlement-gated ('canteen' — starter
// plan schools don't get this feature, see my-todo.md Stage 4). The
// staff-facing routes below use requireEntitlement() middleware, which
// reads the ambient tenant context authController.protect sets up. The
// Person-facing routes at the bottom (no ambient tenant context — a
// Person isn't scoped to one school) check the same entitlement
// explicitly inside their own controller functions instead — see
// canteen.controller.js's createTopUpInvoice/getMyCanteenBalance.

router
	.route('/items/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		requireEntitlement('canteen'),
		canteenItemController.getAllItems
	)
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		requireEntitlement('canteen'),
		canteenItemController.createItem
	);

router
	.route('/items/:id/:tokenID')
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		requireEntitlement('canteen'),
		canteenItemController.editItem
	)
	.delete(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		requireEntitlement('canteen'),
		canteenItemController.deleteItem
	);

router
	.route('/purchase/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_STAFF),
		requireEntitlement('canteen'),
		canteenController.purchase
	);

router
	.route('/ledger/:studentId/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_STAFF),
		requireEntitlement('canteen'),
		canteenController.getLedger
	);

// --- Person-facing (student/parent), also entitlement-gated ---
router.route('/topup/:tokenID').post(personController.protect, canteenController.createTopUpInvoice);

router
	.route('/balance/:studentId/:tokenID')
	.get(personController.protect, canteenController.getMyCanteenBalance);

module.exports = router;
