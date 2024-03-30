const express = require('express');
const RIGHTS = require('./../../utilities/restrict');
const authController = require('./../../controllers/authentication/auth.controller');
const questionCategoryController = require('./../../controllers/question controller/question_category.controller');

const router = express.Router();

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionCategoryController.createCategory
	)
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionCategoryController.getAllCategories
	);

router
	.route('/:catID/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionCategoryController.getCategory
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionCategoryController.editCategory
	)
	.delete(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		questionCategoryController.deleteCategory
	);

module.exports = router;
