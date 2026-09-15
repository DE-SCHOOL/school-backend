const authController = require('./../../controllers/authentication/auth.controller');
const specialtyController = require('./../../controllers/specialty/specialty.controller');
const RIGHTS = require('./../../utilities/restrict');

const express = require('express');

const router = express.Router();

// router.use(authController.protect);

// Was fully unauthenticated (protect/restrictTo commented out) — with
// Specialty now tenant-scoped, an unauthenticated call has no tenant
// context to scope against and would either throw (fail-closed) or, if
// this route were ever changed to swallow that error, risk leaking
// every school's specialties to anyone. Same fix as the old open
// /register route.
router.get(
	'/',
	authController.protect,
	authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
	specialtyController.getAllSpecialties
);

router
	.route('/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		specialtyController.createSpecialty
	)
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		specialtyController.getAllSpecialties
	);

router
	.route('/:id/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_STAFF),
		specialtyController.getSpecialty
	)
	.patch(
		authController.protect,
		authController.restrictTo(...RIGHTS.TO_ALL_OFFICE_ADMIN),
		specialtyController.editSpecialty
	)
	.delete(
		authController.protect,
		authController.restrictTo('admin'),
		specialtyController.deleteSpecialty
	);

module.exports = router;
