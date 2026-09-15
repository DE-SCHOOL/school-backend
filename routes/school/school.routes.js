const express = require('express');
const authController = require('../../controllers/authentication/auth.controller');
const schoolController = require('../../controllers/school/school.controller');
const RIGHTS = require('../../utilities/restrict');

const router = express.Router();

router.get(
	'/:tokenID',
	authController.protect,
	authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
	schoolController.getMySchool
);

module.exports = router;
