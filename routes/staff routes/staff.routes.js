const express = require('express');
const authController = require('./../../controllers/authentication/auth.controller');
const staffController = require('./../../controllers/staff controllers/staff.controller');
const router = express.Router();

// router.use(authController.protect);

router.route('/register').post(authController.register);
router.route('/login').post(authController.login);

router.route('/').get(staffController.getAllStaffs);

module.exports = router;
