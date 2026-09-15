const Invoice = require('../../models/invoice.model');
const Student = require('../../models/students.model');
const walletService = require('../../utilities/stellar/walletService');
const paymentService = require('../../utilities/stellar/paymentService');
const { xafToUsdc } = require('../../utilities/stellar/fxRate');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

// Entitlement-gated (utilities/entitlements.js's 'stellar_payments' —
// starter-plan schools don't get this feature) and TO_ALL_OFFICE_STAFF,
// applied at the route level (routes/stellar/stellar.routes.js).
exports.createFeeInvoice = catchAsync(async (req, res, next) => {
	const { studentId, description, amountXAF, dueDate } = req.body;

	if (!studentId || !description || !amountXAF) {
		return next(new ErrorApi('studentId, description, and amountXAF are required', 400));
	}

	const student = await Student.findById(studentId);
	if (!student) return next(new ErrorApi('Student not found', 404));

	// Supports many-payments-against-one-invoice from day one
	// (my-todo.md Stage 6.3's own requirement — Cameroonian school fees
	// are commonly paid in tranches, not one lump sum) simply by never
	// requiring full payment to close out a create call; see
	// paymentService.js's reconciliation for how partial payments accrue.
	const invoice = await Invoice.create({
		type: 'student_fee',
		studentId,
		description,
		amountXAF,
		amountUsdc: xafToUsdc(amountXAF),
		dueDate,
	});

	sendResponse(res, 'success', 201, invoice);
});

exports.getStudentFeeInvoices = catchAsync(async (req, res, next) => {
	const invoices = await Invoice.find({ type: 'student_fee', studentId: req.params.studentId });
	sendResponse(res, 'success', 200, invoices);
});

// Public — deliberately no auth. A donor/parent funding a specific
// student's fees (my-todo.md Stage 6.5's scholarship-disbursement
// feature) is very often not a platform account holder at all. Reusing
// the exact same Invoice + payment URI + reconciliation mechanism a
// normal fee payment uses — anyone who pays this invoice's memo to the
// school's wallet satisfies it, the payer's identity is whatever
// Stellar account actually sent it (recorded automatically in
// payments[].fromPublicKey), no separate "scholarship" subsystem needed.
exports.getPublicInvoicePayInfo = catchAsync(async (req, res, next) => {
	const invoice = await Invoice.findOne({ memo: req.params.memo }).setOptions({
		skipTenantScope: true,
	});
	if (!invoice) return next(new ErrorApi('No invoice found for that reference', 404));

	const schoolWallet = await walletService.getOrCreateWallet('school', invoice.schoolId);
	if (schoolWallet.status !== 'active') {
		return next(new ErrorApi('This school is not yet set up to receive Stellar payments', 400));
	}

	sendResponse(res, 'success', 200, {
		description: invoice.description,
		amountUsdc: invoice.amountUsdc,
		amountXAF: invoice.amountXAF,
		status: invoice.status,
		totalPaidUsdc: invoice.totalPaidUsdc(),
		paymentUri: paymentService.paymentUri({
			destinationPublicKey: schoolWallet.publicKey,
			amountUsdc: invoice.amountUsdc - invoice.totalPaidUsdc(),
			memo: invoice.memo,
		}),
	});
});

// TO_MAIN_ADMIN — triggers reconciliation of the school's own wallet.
// No background job scheduler exists in this codebase (see
// paymentService.js's own comment), so this is a real, callable,
// on-demand action today; a cron calling this same endpoint (or the
// underlying service function directly) is a natural, contained
// follow-up once one exists.
exports.reconcileSchoolWallet = catchAsync(async (req, res, next) => {
	const wallet = await require('../../models/stellar_wallet.model')
		.findOne({ ownerType: 'school', ownerId: req.staff.schoolId })
		.select('+encryptedSecret');

	if (!wallet || wallet.status !== 'active') {
		return next(new ErrorApi('School wallet is not active yet', 400));
	}

	const { newlyPaidInvoices, recordedPayments } = await paymentService.reconcileAndApply(wallet);

	sendResponse(res, 'success', 200, {
		newlyPaidInvoiceIds: newlyPaidInvoices.map((i) => i._id),
		paymentsRecorded: recordedPayments.length,
	});
});

// A Person paying their own linked student's fee invoice directly from
// their platform-custodial wallet balance — see walletService.js's
// sendPayment for why this exists alongside the external-wallet/QR
// flow. Person-authenticated; the invoice's studentId must be one of
// the caller's own linked enrollments (Stage 5), never someone else's.
exports.payInvoiceFromPersonWallet = catchAsync(async (req, res, next) => {
	const invoice = await Invoice.findById(req.params.invoiceId).setOptions({
		skipTenantScope: true,
	});
	if (!invoice || invoice.type !== 'student_fee') {
		return next(new ErrorApi('Fee invoice not found', 404));
	}

	const student = await Student.findById(invoice.studentId).setOptions({ skipTenantScope: true });
	if (!student || !student.personId || String(student.personId) !== String(req.person._id)) {
		return next(new ErrorApi('This invoice is not linked to one of your own enrollments', 403));
	}

	const remaining = invoice.amountUsdc - invoice.totalPaidUsdc();
	if (remaining <= 0) {
		return next(new ErrorApi('This invoice is already fully paid', 400));
	}

	const personWallet = await require('../../models/stellar_wallet.model')
		.findOne({ ownerType: 'person', ownerId: req.person._id })
		.select('+encryptedSecret');
	if (!personWallet || personWallet.status !== 'active') {
		return next(new ErrorApi('Your wallet is not active yet', 400));
	}

	const schoolWallet = await walletService.getOrCreateWallet('school', invoice.schoolId);

	const result = await walletService.sendPayment(
		personWallet,
		schoolWallet.publicKey,
		remaining,
		invoice.memo
	);

	// Reconcile immediately — the payment the caller just made is now
	// sitting in Horizon's payment stream, no reason to make them wait
	// for a separate manual reconcile call to see their own invoice
	// update.
	await paymentService.reconcileAndApply(schoolWallet);
	const updatedInvoice = await Invoice.findById(invoice._id).setOptions({ skipTenantScope: true });

	sendResponse(res, 'success', 200, { transactionHash: result.hash, invoice: updatedInvoice });
});
