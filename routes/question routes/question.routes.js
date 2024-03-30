const express = require('express');
const RIGHTS = require('./../../utilities/restrict');
const authController = require('./../../controllers/authentication/auth.controller');
const questionController = require('./../../controllers/question controller/question.controller');

const router = express.Router();

router.route('/').get(questionController.getAllQuestions);

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
