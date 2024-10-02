const formBController = require('./../../controllers/form b/formb.controller');
const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const restrict = require('./../../utilities/restrict');

const router = express.Router();

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...restrict.TO_ALL_OFFICE_ADMIN),
		formBController.createFormB
	)
	.get(
		authController.protect,
		authController.restrictTo(...restrict.TO_ALL_OFFICE_STAFF),
		formBController.getAllFormBs
	);
router
	.route('/:id/:tokenID')
	.delete(
		authController.protect,
		authController.restrictTo(...restrict.TO_ALL_OFFICE_ADMIN),
		formBController.deleteFormB
	);
module.exports = router;
