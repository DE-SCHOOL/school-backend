const express = require('express');
const RIGHTS = require('./../../utilities/restrict');
const authController = require('./../../controllers/authentication/auth.controller');
const questionController = require('./../../controllers/question/question.controller');

const router = express.Router();

// Was `router.route('/').get(questionController.getAllQuestions)` with
// no protect at all — same dead-duplicate pattern as
// program.routes.js's identical fix (see its comment for the full
// reasoning); questionSlice.js's real call always lands on the
// protected /:tokenID route below instead.

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionController.createQuestion
	)
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionController.getAllQuestions
	);

router
	.route('/:questionID/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionController.getQuestion
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionController.editQuestion
	)
	.delete(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionController.deleteQuestion
	);

module.exports = router;
