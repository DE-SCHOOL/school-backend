const authController = require('./../../controllers/authentication/auth.controller');
const studentController = require('./../../controllers/student controllers/student.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

//temporal stud registration
router
	.route('/academic-year/:academicYearID')
	.post(studentController.createStudent);
router
	.route('/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo('admin'),
		studentController.getAllStudents
	);
router
	.route('/academic-year/:academicYearID/:tokenID')
	.get(authController.protect, studentController.getStudentPerAcademicYear)
	.post(
		authController.protect,
		authController.restrictTo('admin', 'director', 'hod', 'secreteriat'),
		studentController.createStudent
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		studentController.getStudent
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_STAFF),
		studentController.editStudent
	)
	.delete(
		authController.protect,
		authController.restrictTo('admin'),
		studentController.deleteStudent
	);

router.get(
	'/:staffID/students/:tokenID',
	authController.protect,
	authController.restrictTo(...RIGHT.TO_ALL_STAFF),
	studentController.getStudentsPerStaff
);

router.get(
	'/academic-year/:academicYearID/course/:courseID/:tokenID',
	authController.protect,
	authController.restrictTo(...RIGHT.TO_ALL_STAFF),
	studentController.getStudentsPerCourseOffering
);

router.post(
	'/search/:tokenID',
	authController.protect,
	authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
	studentController.getStudentPerSearch
);

module.exports = router;
