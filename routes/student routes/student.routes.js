const authController = require('./../../controllers/authentication/auth.controller');
const studentController = require('./../../controllers/student controllers/student.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

// router.use(
// 	authController.restrictTo('admin', 'director', 'hod', 'secreteriat')
// );

router
	.route('/')
	.get(studentController.getAllStudents)
	.post(
		authController.restrictTo('admin', 'director', 'hod', 'secreteriat'),
		studentController.createStudent
	);

router.get('/:staffID/students', authController.restrictTo(...RIGHT.TO_ALL_STAFF), studentController.getStudentsPerStaff);
module.exports = router;
