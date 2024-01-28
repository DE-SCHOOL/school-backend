const authController = require('./../../controllers/authentication/auth.controller');
const programController = require('./../../controllers/program controllers/programs.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

router
	.route('/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		programController.getPrograms
	)
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		programController.createProgram
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		programController.getProgram
	)
	.patch(
		authController.protect,
		authController.restrictTo('admin'),
		programController.editProgram
	);

module.exports = router;
