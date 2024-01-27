const authController = require('./../../controllers/authentication/auth.controller');
const marksController = require('./../../controllers/marks controllers/mark.controllers');
const RIGHT = require('./../../utilities/restrict');
const express = require('express');

const router = express.Router();

// router.use(authController.protect);

router
	.route('/:courseID/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		marksController.createStudentsMark
	);
router.get(
	'/',
	authController.protect,
	authController.restrictTo(...RIGHT.TO_ALL_OFFICE_ADMIN),
	marksController.getAllStudentsMarkSheet
);

router.route('/course/:courseID/students/:tokenID').post(
	//using post for getting data because request needs data from the request body
	authController.protect,
	authController.restrictTo(...RIGHT.TO_ALL_STAFF),
	marksController.getMarkSheetsPerCoursePerStudents
);

// const markType = ['s1CA', 's1Exam', 's2CA', 's2Exam', 'preMock', 'mock'];
router
	.route('/:courseID/:markType/:tokenID')
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_STAFF),
		marksController.updateStudentsMark
	);

router
	.route('/student/courses/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		marksController.getStudentMarkSheetAllCourses
	);
module.exports = router;
