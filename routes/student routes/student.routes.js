const authController = require('./../../controllers/authentication/auth.controller');
const studentController = require('./../../controllers/student controllers/student.controller');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

router
	.route('/')
	.get(studentController.getAllStudents)
	.post(
		// authController.restrictTo('admin', 'director', 'hod', 'secreteriat'),
		studentController.createStudent
	);

module.exports = router;
