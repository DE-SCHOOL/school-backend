const express = require('express');
const personController = require('../../controllers/person/person.controller');

const router = express.Router();

router.route('/signup').post(personController.signup);
router.route('/login').post(personController.login);

router
	.route('/link-enrollment/:tokenID')
	.post(personController.protect, personController.linkEnrollment);

router
	.route('/enrollments/:tokenID')
	.get(personController.protect, personController.listEnrollments);

router
	.route('/enrollments/:studentId/switch/:tokenID')
	.post(personController.protect, personController.switchEnrollment);

module.exports = router;
