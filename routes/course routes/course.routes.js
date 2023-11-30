const authController = require('./../../controllers/authentication/auth.controller');
const courseController = require('./../../controllers/course controllers/course.controller');
const RIGHT = require('./../../utilities/restrict');
const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.post(
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
		courseController.createCourse
	)
	.get(
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		courseController.getAllCourses
	);

module.exports = router;
