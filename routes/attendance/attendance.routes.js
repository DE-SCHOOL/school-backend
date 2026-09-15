const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const attendanceController = require('./../../controllers/attendance/attendance.controller');
const RIGHTS = require('./../../utilities/restrict');

const router = express.Router();

// Was fully unauthenticated — same fix as specialty.routes.js's GET '/'.
router
	.route('/')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		attendanceController.createAttendanceSheet
	);

module.exports = router;
