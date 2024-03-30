const express = require('express');
const RIGHTS = require('./../../utilities/restrict');
const authController = require('./../../controllers/authentication/auth.controller');
const reviewController = require('./../../controllers/review controller/review.controller');

const router = express.Router();

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		reviewController.createReview
	)
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		reviewController.getAllReview
	);
router.route('/many').post(reviewController.createManyReviews);

router
	.route('/many/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		reviewController.createManyReviews
	);

router
	.route('/:reviewID/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		reviewController.getReview
	);

module.exports = router;
