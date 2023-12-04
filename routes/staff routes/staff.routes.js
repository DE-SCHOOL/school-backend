const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const staffController = require('./../../controllers/staff controllers/staff.controller');
const router = express.Router();

router.route('/login').post(authController.login);
router.route('/logout').get(authController.logOut);

router.use(authController.protect);
router
	.route('/register')
	.post(
		authController.restrictTo('admin', 'director', 'hod'),
		authController.register
	);

// router.use(authController.restrictTo('hod', 'admin', 'director', 'lecturer', 'secreteriat'));

router
	.route('/')
	.get(
		authController.restrictTo(
			'hod',
			'admin',
			'director',
			'lecturer',
			'secreteriat'
		),
		staffController.getAllStaffs
	);

// router.route('/:courseID')

module.exports = router;
