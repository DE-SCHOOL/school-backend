const authController = require('./../../controllers/authentication/auth.controller');
const programController = require('./../../controllers/program controllers/programs.controller');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.post(authController.restrictTo('admin'), programController.createProgram);

module.exports = router;
