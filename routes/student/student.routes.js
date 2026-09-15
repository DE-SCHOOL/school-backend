const authController = require('./../../controllers/authentication/auth.controller');
const studentController = require('./../../controllers/student/student.controller');
const RIGHT = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

// Was `router.route('/academic-year/:academicYearID').post(studentController.createStudent)`
// with NO authController.protect at all ("temporal stud registration")
// — anyone on the internet could create arbitrary student records,
// personal data (dob, address, parent contact info) included. Same
// category of hole as the other open routes fixed in Stage 3
// (specialty, attendance, /register); missed there because it's a
// route-chain .post() with no protect() call in it, not a bare
// router.post() the earlier automated scan was built to catch — found
// now while building Stage 5's verification script, which creates a
// real student. Removed rather than protected: this path has no
// :tokenID segment at all, so protect() would reject every request to
// it unconditionally, and the frontend's actual "create student" call
// (studentSlice.js) already always lands on the identical, properly
// protected route two lines below (apiRequest.js appends the caller's
// token as a URL suffix automatically, so it never actually hits this
// bare path in practice) — this was dead, insecure code, not a route
// anything relies on.
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
	.route('/:id/academic-year/:academicYearID/:tokenID')
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

router
	.route('/:id/academic-year/:academicYearID/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		studentController.getStudent
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
	'/search/:academicYearID/:tokenID',
	authController.protect,
	authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
	studentController.getStudentPerSearch
);

module.exports = router;
