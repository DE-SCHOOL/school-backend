const express = require('express');
const platformAuthController = require('../../controllers/platform/platform_auth.controller');
const schoolController = require('../../controllers/platform/school.controller');
const { TO_PLATFORM_SUPER_ADMIN } = require('../../utilities/restrict');

const router = express.Router();

router.route('/login').post(platformAuthController.login);

router
	.route('/schools/:tokenID')
	.get(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		schoolController.getAllSchools
	)
	.post(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		schoolController.createSchool
	);

router
	.route('/schools/:id/:tokenID')
	.get(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		schoolController.getSchool
	)
	.patch(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		schoolController.setSchoolStatus
	);

module.exports = router;
