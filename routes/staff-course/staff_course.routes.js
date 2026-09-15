const authController = require('./../../controllers/authentication/auth.controller');
const staffCourseController = require('./../../controllers/staff-course/staff_course.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');
const router = express.Router();

// router.use(authController.protect);

// Was `router.route('/').get(staffCourseController.getStaffCourse)`
// with no protect at all — same dead-duplicate pattern as
// program.routes.js's identical fix (see its comment for the full
// reasoning); dashboardSlice.js's real call always lands on the
// protected /:tokenID route below instead.

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
