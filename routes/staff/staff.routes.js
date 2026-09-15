const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const staffController = require('./../../controllers/staff/staff.controller');
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

// Was: router.route('/register').post(authController.register) — an
// entirely unauthenticated route ("ONLY FOR DEV" per its own comment,
// but live in production with no `protect` at all) that let anyone on
// the internet create an arbitrary admin-role staff account. Creating a
// brand-new school's first admin is now a platform-super-admin-only
// action — see routes/platform/platform.routes.js's POST /schools/:tokenID
// and controllers/platform/school.controller.js's createSchool.

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
	)
	.delete(
		authController.protect,
		authController.restrictTo('admin'),
		staffController.deleteStaff
	);

// router.route('/:courseID')

module.exports = router;
