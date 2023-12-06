const authController = require('./../../controllers/authentication/auth.controller');
const staffCourseController = require('./../../controllers/staff_course controllers/staff_course.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');
const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.get(
		authController.restrictTo(...RIGHT.TO_MAIN_ADMIN),
		staffCourseController.getStaffCourse
	)
	.post(
		authController.restrictTo(...RIGHT.TO_MAIN_ADMIN),
		staffCourseController.assignStaffCourse
	);

module.exports = router;
