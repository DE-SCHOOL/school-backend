const authController = require('./../../controllers/authentication/auth.controller');
const programController = require('./../../controllers/program controllers/programs.controller');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.get(
		authController.restrictTo('admin', 'director'),
		programController.getPrograms
	)
	.post(authController.restrictTo('admin'), programController.createProgram);

module.exports = router;
