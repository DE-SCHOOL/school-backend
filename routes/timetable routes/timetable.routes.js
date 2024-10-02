const timetableControllers = require('./../../controllers/timetable controllers/timetable.controller');
const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const restrict = require('./../../utilities/restrict');

const router = express.Router();

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...restrict.TO_ALL_OFFICE_ADMIN),
		timetableControllers.createTimetable
	)
	.get(
		authController.protect,
		authController.restrictTo(...restrict.TO_ALL_OFFICE_STAFF),
		timetableControllers.getAllTimetables
	);
router
	.route('/:id/:tokenID')
	.delete(
		authController.protect,
		authController.restrictTo(...restrict.TO_ALL_OFFICE_ADMIN),
		timetableControllers.deleteTimetable
	);
module.exports = router;
