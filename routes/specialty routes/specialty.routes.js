const authController = require('./../../controllers/authentication/auth.controller');
const specialtyController = require('./../../controllers/specialty controllers/specialty.controller');

const express = require('express');

const router = express.Router();

router.use(authController.protect);

router
	.route('/')
	.post(
		authController.restrictTo('admin', 'director', 'hod'),
		specialtyController.createSpecialty
	)
	.get(specialtyController.getAllSpecialties);

// router.route('/:id').get(specialtyController.getSpecialtyCoursesInfo);

module.exports = router;
