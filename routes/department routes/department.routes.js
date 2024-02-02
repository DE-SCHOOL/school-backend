const authController = require('./../../controllers/authentication/auth.controller');
const departmentController = require('./../../controllers/department controllers/department.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

router
	.route('/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		departmentController.getAllDepartments
	)
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_MAIN_ADMIN),
		departmentController.createDepartment
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		departmentController.getDepartment
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_MAIN_ADMIN),
		departmentController.editDepartment
	)
	.delete(
		authController.protect,
		authController.restrictTo('admin'),
		departmentController.deleteDepartment
	);

module.exports = router;
