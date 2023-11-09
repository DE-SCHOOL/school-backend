const authController = require('./../../controllers/authentication/auth.controller');
const departmentController = require('./../../controllers/department controllers/department.controller');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.post(
		authController.restrictTo('admin', 'director'),
		departmentController.createDepartment
	);

module.exports = router;
