const authController = require('./../../controllers/authentication/auth.controller');
const programController = require('./../../controllers/program controllers/programs.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.get(
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		programController.getPrograms
	)
	.post(authController.restrictTo('admin'), programController.createProgram);

router
	.route('/:id')
	.get(
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		programController.getProgram
	)
	.patch(authController.restrictTo('admin'), programController.editProgram);

module.exports = router;
