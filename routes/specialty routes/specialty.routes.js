const authController = require('./../../controllers/authentication/auth.controller');
const specialtyController = require('./../../controllers/specialty controllers/specialty.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

router.get(
	'/',
	// authController.protect,
	// authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
	specialtyController.getAllSpecialties
);

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		specialtyController.createSpecialty
	)
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		specialtyController.getAllSpecialties
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		specialtyController.getSpecialty
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		specialtyController.editSpecialty
	);

module.exports = router;
