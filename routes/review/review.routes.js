const express = require('express');
const RIGHTS = require('./../../utilities/restrict');
const authController = require('./../../controllers/authentication/auth.controller');
const reviewController = require('./../../controllers/review/review.controller');

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

router
	.route('/filtered-review/:tokenID')
	.post(
		authController.protect,
		reviewController.getReviewPerSchoolPerBackground
	);

// Was `router.route('/many').post(reviewController.createManyReviews)`
// with no protect at all — a write, not just a read, so this was worse
// than the same dead-duplicate pattern found elsewhere (see
// program.routes.js's comment for the full reasoning); reviewSlice.js's
// real call always lands on the protected /many/:tokenID route below
// instead.

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
