const authController = require('./../../controllers/authentication/auth.controller');
const departmentController = require('./../../controllers/department controllers/department.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.get(
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		departmentController.getAllDepartments
	)
	.post(
		authController.restrictTo(...RIGHTS.TO_MAIN_ADMIN),
		departmentController.createDepartment
	);

router
	.route('/:id')
	.get(
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		departmentController.getDepartment
	)
	.patch(
		authController.restrictTo(...RIGHTS.TO_MAIN_ADMIN),
		departmentController.editDepartment
	);

module.exports = router;
