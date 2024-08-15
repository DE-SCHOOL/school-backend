const express = require('express');
const authController = require('../../controllers/authentication/auth.controller');
const StudentAcademicYear = require('./../../controllers/academic_year controller/student_academic_year.controller');

const router = express.Router();

router
	.route('/bulk-insert/:tokenID')
	.post(
		authController.protect,
		StudentAcademicYear.createStudentAcademicYearBulk
	);

router
	.route('/:academicYearID/:tokenID')
	.get(authController.protect, StudentAcademicYear.getStudentPerAcademicYear);

router
	.route('/:academicYearID/promote-student/:tokenID')
	.post(authController.protect, StudentAcademicYear.promoteStudent);

module.exports = router;
