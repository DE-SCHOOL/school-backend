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
	)
	.delete(
		authController.protect,
		authController.restrictTo('admin'),
		courseController.deleteCourse
	);

router
	.route('/specialty/:id/:tokenID')
	.get(authController.protect, courseController.getCoursesPerSpecialty);

router
	.route('/level/specialty/:id/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		courseController.getCoursesPerSpecialtyPerLevel
	);

router
	.route('/statistics/:courseID/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		courseController.primaryCourseStatistics
	);

router
	.route('/statistics/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		courseController.primaryCoursesStatistics
	);

router
	.route('/search-courses/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		courseController.getCoursesPerSearch
	);

router
	.route('/resit/:semester/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		courseController.getCoursesResit
	);

module.exports = router;
