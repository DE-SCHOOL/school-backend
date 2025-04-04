const express = require('express');
const studentAuth = require('./../../controllers/authentication/auth.student.controller');
const courseController = require('./../../controllers/course controllers/course.controller');
const studentController = require('./../../controllers/student controllers/student.controller');
const marksController = require('./../../controllers/marks controllers/mark.controllers');

const router = express.Router();

router.route('/register').patch(studentAuth.signUp);
router.route('/login').post(studentAuth.login);

router
	.route('/timetables/:tokenID')
	.post(studentAuth.protect, studentController.getTimetables);

router
	.route('/form-b/:tokenID')
	.post(studentAuth.protect, studentController.getFormBs);

router
	.route('/:id/:tokenID')
	.patch(studentAuth.protect, studentController.editStudent);

// @Overiding route in /course
router
	.route('/level/specialty/:id/:tokenID')
	.post(studentAuth.protect, courseController.getCoursesPerSpecialtyPerLevel);

router
	.route('/student/courses/:tokenID')
	.post(studentAuth.protect, marksController.getStudentMarkSheetAllCourses);

router
	.route('/student/level/:tokenID')
	.post(studentAuth.protect, studentController.getStudentPerSearch);

module.exports = router;

// TODO: Implement password reset, email verification, and password change routes
