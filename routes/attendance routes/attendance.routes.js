const express = require('express');
const attendanceController = require('./../../controllers/attendance controllers/attendance.controller');
const RIGHTS = require('./../../utilities/restrict');

const router = express.Router();

router.route('/').post(attendanceController.createAttendanceSheet);

module.exports = router;
