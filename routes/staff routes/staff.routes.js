const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const staffController = require('./../../controllers/staff controllers/staff.controller');
const RIGHTS = require('./../../utilities/restrict');
const router = express.Router();

router.route('/login').post(authController.login);
router.route('/logout').get(authController.logOut);

router
	.route('/register/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		authController.register
	);

// router.use(authController.restrictTo('hod', 'admin', 'director', 'lecturer', 'secreteriat'));

router
	.route('/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		staffController.getAllStaffs
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		staffController.getStaff
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		staffController.editStaff
	);

// router.route('/:courseID')

module.exports = router;
