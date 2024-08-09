const express = require('express');
const authController = require('../../controllers/authentication/auth.controller');
const AcademicYear = require('./../../controllers/academic_year controller/academic_year.controller');

const router = express.Router();

router
	.route('/:tokenID')
	.get(authController.protect, AcademicYear.getAcademicYears)
	.post(authController.protect, AcademicYear.createAcademicYear);
router
	.route('/:id/:tokenID')
	.patch(authController.protect, AcademicYear.updateAcademicYears);
router
	.route('/current/:tokenID')
	.get(authController.protect, AcademicYear.getCurrentYear);

module.exports = router;
