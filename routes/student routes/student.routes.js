const authController = require('./../../controllers/authentication/auth.controller');
const studentController = require('./../../controllers/student controllers/student.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.get(studentController.getAllStudents)
	.post(
		authController.restrictTo('admin', 'director', 'hod', 'secreteriat'),
		studentController.createStudent
	);

router
	.route('/:id')
	.get(
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		studentController.getStudent
	)
	.patch(
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_STAFF),
		studentController.editStudent
	);

router.get(
	'/:staffID/students',
	authController.restrictTo(...RIGHT.TO_ALL_STAFF),
	studentController.getStudentsPerStaff
);

router.get(
	'/course/:courseID',
	authController.restrictTo(...RIGHT.TO_ALL_STAFF),
	studentController.getStudentsPerCourseOffering
);

module.exports = router;
