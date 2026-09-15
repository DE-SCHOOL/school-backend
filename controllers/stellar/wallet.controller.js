const walletService = require('../../utilities/stellar/walletService');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

exports.getSchoolWallet = catchAsync(async (req, res, next) => {
	const wallet = await walletService.getOrCreateWallet('school', req.staff.schoolId);
	const balances = wallet.status === 'active' ? await walletService.getBalances(wallet) : [];

	sendResponse(res, 'success', 200, {
		publicKey: wallet.publicKey,
		network: wallet.network,
		status: wallet.status,
		balances,
	});
});

exports.getPersonWallet = catchAsync(async (req, res, next) => {
	const wallet = await walletService.getOrCreateWallet('person', req.person._id);
	const balances = wallet.status === 'active' ? await walletService.getBalances(wallet) : [];

	sendResponse(res, 'success', 200, {
		publicKey: wallet.publicKey,
		network: wallet.network,
		status: wallet.status,
		balances,
	});
});

// Real Stellar multi-signature (utilities/stellar/walletService.js's
// addTreasurySigner) — a school's finance office shouldn't have a
// single point-of-failure key controlling tuition revenue (my-todo.md
// Stage 6.5). TO_MAIN_ADMIN-only: this changes who can move the
// school's money, about as sensitive an action as exists in this app.
exports.addTreasurySigner = catchAsync(async (req, res, next) => {
	const { signerPublicKey, weight, medThreshold, highThreshold } = req.body;

	if (!signerPublicKey || !weight || !medThreshold || !highThreshold) {
		return next(
			new ErrorApi(
				'signerPublicKey, weight, medThreshold, and highThreshold are all required',
				400
			)
		);
	}

	const wallet = await walletService.getOrCreateWallet('school', req.staff.schoolId);
	if (wallet.status !== 'active') {
		return next(new ErrorApi('School wallet is not active yet', 400));
	}

	const walletWithSecret = await require('../../models/stellar_wallet.model')
		.findById(wallet._id)
		.select('+encryptedSecret');

	const result = await walletService.addTreasurySigner(walletWithSecret, signerPublicKey, {
		weight,
		medThreshold,
		highThreshold,
	});

	sendResponse(res, 'success', 200, { transactionHash: result.hash, successful: result.successful });
});
