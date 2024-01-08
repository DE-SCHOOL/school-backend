const authController = require('./../../controllers/authentication/auth.controller');
const specialtyController = require('./../../controllers/specialty controllers/specialty.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.post(
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		specialtyController.createSpecialty
	)
	.get(
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		specialtyController.getAllSpecialties
	);

router
	.route('/:id')
	.get(
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		specialtyController.getSpecialty
	)
	.patch(
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		specialtyController.editSpecialty
	);

module.exports = router;
