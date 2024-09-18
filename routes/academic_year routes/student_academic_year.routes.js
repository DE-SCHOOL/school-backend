const express = require('express');
const authController = require('../../controllers/authentication/auth.controller');
const studentAuthController = require('./../../controllers/authentication/auth.student.controller');
const studentAcademicYear = require('./../../controllers/academic_year controller/student_academic_year.controller');

const router = express.Router();

router
	.route('/:nextAcademicYearID/:tokenID')
	.delete(authController.protect, studentAcademicYear.deletePromotedStudent);
router
	.route('/bulk-insert/:tokenID')
	.post(
		authController.protect,
		studentAcademicYear.createStudentAcademicYearBulk
	);

router
	.route('/:academicYearID/:tokenID')
	.get(authController.protect, studentAcademicYear.getStudentPerAcademicYear);

router
	.route('/:academicYearID/promote-student/:tokenID')
	.post(authController.protect, studentAcademicYear.promoteStudent);

router
	.route('/:academicYearID/bulk-promote/:tokenID')
	.post(authController.protect, studentAcademicYear.promoteStudentsBulk);

router
	.route('/:studentId/all-years/:tokenID')
	.get(
		studentAuthController.protect,
		studentAcademicYear.getStudentAccrossYears
	);
module.exports = router;
