const express = require('express');
const platformAuthController = require('../../controllers/platform/platform_auth.controller');
const schoolController = require('../../controllers/platform/school.controller');
const demoRequestController = require('../../controllers/platform/demo_request.controller');
const { TO_PLATFORM_SUPER_ADMIN } = require('../../utilities/restrict');

const router = express.Router();

router.route('/login').post(platformAuthController.login);

// Public — no auth, no :tokenID. The one deliberately-unauthenticated
// route in this whole router; see demo_request.controller.js.
router.route('/demo-requests').post(demoRequestController.createDemoRequest);

router
	.route('/demo-requests/:tokenID')
	.get(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		demoRequestController.getAllDemoRequests
	);

router
	.route('/demo-requests/:id/:tokenID')
	.patch(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		demoRequestController.setDemoRequestStatus
	);

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

router
	.route('/schools/:id/subscription/:tokenID')
	.get(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		schoolController.getSubscription
	)
	.patch(
		platformAuthController.protect,
		platformAuthController.restrictTo(...TO_PLATFORM_SUPER_ADMIN),
		schoolController.updateSubscription
	);

module.exports = router;
