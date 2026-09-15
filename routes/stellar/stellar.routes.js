const express = require('express');
const authController = require('../../controllers/authentication/auth.controller');
const personController = require('../../controllers/person/person.controller');
const platformAuthController = require('../../controllers/platform/platform_auth.controller');
const walletController = require('../../controllers/stellar/wallet.controller');
const feePaymentController = require('../../controllers/stellar/fee_payment.controller');
const subscriptionPaymentController = require('../../controllers/stellar/subscription_payment.controller');
const RIGHT = require('../../utilities/restrict');
const { requireEntitlement } = require('../../utilities/entitlements');

const router = express.Router();

// --- School treasury (staff) ---
router
	.route('/wallet/school/:tokenID')
	.get(authController.protect, authController.restrictTo(...RIGHT.TO_MAIN_ADMIN), walletController.getSchoolWallet);

router
	.route('/wallet/school/treasury-signer/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_MAIN_ADMIN),
		walletController.addTreasurySigner
	);

// --- Person's own wallet ---
router.route('/wallet/person/:tokenID').get(personController.protect, walletController.getPersonWallet);

// --- Student fee payments (entitlement-gated: 'stellar_payments') ---
router
	.route('/fees/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_STAFF),
		requireEntitlement('stellar_payments'),
		feePaymentController.createFeeInvoice
	);

router
	.route('/fees/student/:studentId/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_ALL_OFFICE_STAFF),
		feePaymentController.getStudentFeeInvoices
	);

router
	.route('/fees/reconcile/:tokenID')
	.post(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_MAIN_ADMIN),
		feePaymentController.reconcileSchoolWallet
	);

router
	.route('/fees/:invoiceId/pay-from-wallet/:tokenID')
	.post(personController.protect, feePaymentController.payInvoiceFromPersonWallet);

// Public — no auth, no entitlement gate (a donor/parent paying a
// specific invoice isn't necessarily a platform account holder at all;
// see fee_payment.controller.js's own comment).
router.route('/invoices/:memo/pay-info').get(feePaymentController.getPublicInvoicePayInfo);

// --- Subscription billing (platform-only) ---
router
	.route('/subscription/:schoolId/invoice/:tokenID')
	.post(
		platformAuthController.protect,
		platformAuthController.restrictTo(...RIGHT.TO_PLATFORM_SUPER_ADMIN),
		subscriptionPaymentController.createSubscriptionInvoice
	);

router
	.route('/subscription/invoices/:tokenID')
	.get(
		authController.protect,
		authController.restrictTo(...RIGHT.TO_MAIN_ADMIN),
		subscriptionPaymentController.getSchoolSubscriptionInvoices
	);

router
	.route('/subscription/reconcile/:tokenID')
	.post(
		platformAuthController.protect,
		platformAuthController.restrictTo(...RIGHT.TO_PLATFORM_SUPER_ADMIN),
		subscriptionPaymentController.reconcilePlatformWallet
	);

module.exports = router;
