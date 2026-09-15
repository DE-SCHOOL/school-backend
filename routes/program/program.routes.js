const authController = require('./../../controllers/authentication/auth.controller');
const programController = require('./../../controllers/program/programs.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

// Was `router.route('/').get(programController.getPrograms)` with no
// protect at all. Same fix as the routes documented in Stage 3/5's
// audit findings (student.routes.js has the full account): the
// frontend's real call (programSlice.js) always lands on the identical,
// properly protected /:tokenID route below instead — apiRequest.js
// appends the caller's token as a URL suffix whenever one exists, so
// this bare path was unreachable in normal use, not a route anything
// relies on. Removed rather than left as dead, insecure code.

router
	.route('/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		programController.getPrograms
	)
	.post(
		authController.protect,
		authController.restrictTo('admin'),
		programController.createProgram
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		programController.getProgram
	)
	.patch(
		authController.protect,
		authController.restrictTo('admin'),
		programController.editProgram
	)
	.delete(
		authController.protect,
		authController.restrictTo('admin'),
		programController.deleteProgram
	);

module.exports = router;
