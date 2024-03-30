const authController = require('./../../controllers/authentication/auth.controller');
const staffCourseController = require('./../../controllers/staff_course controllers/staff_course.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');
const router = express.Router();

// router.use(authController.protect);

router.route('/').get(staffCourseController.getStaffCourse);

router
	.route('/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		staffCourseController.getStaffCourse
	)
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		staffCourseController.assignStaffCourse
	);

router
	.route('/:teacherID/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		staffCourseController.getMyCourses
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		staffCourseController.editAssignedCourses
	);
module.exports = router;
