const authController = require('./../../controllers/authentication/auth.controller');
const courseController = require('./../../controllers/course controllers/course.controller');
const RIGHT = require('./../../utilities/restrict');
const express = require('express');

const router = express.Router();

// router.use(authController.protect);

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		courseController.createCourse
	)
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		courseController.getAllCourses
	);
router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		courseController.getCourse
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		courseController.editCourse
	);

router
	.route('/specialty/:id/:tokenID')
	.get(authController.protect, courseController.getCoursesPerSpecialty);

module.exports = router;
