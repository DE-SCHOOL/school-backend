const mongoose = require('mongoose');
const { Keypair, TransactionBuilder, Operation } = require('@stellar/stellar-sdk');
const StellarWallet = require('../../models/stellar_wallet.model');
const encryption = require('../encryption');
const { server, NETWORK, NETWORK_PASSPHRASE } = require('./client');
const { usdcAsset } = require('./asset');

const OWNER_MODEL_BY_TYPE = { school: 'school', person: 'person', platform: 'platform' };

// The platform's own treasury wallet — a fixed, well-known ObjectId
// rather than a real document anywhere, since there's exactly one of
// these per deployment. Subscription payments (schools paying the
// platform) settle here.
const PLATFORM_OWNER_ID = new mongoose.Types.ObjectId('000000000000000000000001');

async function getOrCreatePlatformWallet() {
	return getOrCreateWallet('platform', PLATFORM_OWNER_ID);
}

async function fundOnTestnet(publicKey) {
	// Real mainnet funding means a school/person actually buying XLM —
	// nothing this codebase can do on someone's behalf. Testnet funding
	// (Friendbot, free play-money XLM) is the one part of wallet creation
	// that's genuinely testnet-only; everything else in this file works
	// identically on both networks.
	await server.friendbot(publicKey).call();
}

async function establishUsdcTrustline(keypair) {
	const account = await server.loadAccount(keypair.publicKey());
	const fee = await server.fetchBaseFee();

	const tx = new TransactionBuilder(account, {
		fee: String(fee),
		networkPassphrase: NETWORK_PASSPHRASE,
	})
		.addOperation(Operation.changeTrust({ asset: usdcAsset() }))
		.setTimeout(30)
		.build();

	tx.sign(keypair);
	await server.submitTransaction(tx);
}

// Idempotent — safe to call repeatedly for the same owner (e.g. every
// time a student's fee-payment screen loads); returns the existing
// wallet rather than erroring or creating a duplicate.
async function getOrCreateWallet(ownerType, ownerId) {
	const existing = await StellarWallet.findOne({ ownerType, ownerId });
	if (existing) return existing;

	const keypair = Keypair.random();

	const wallet = await StellarWallet.create({
		ownerType,
		ownerId,
		ownerModel: OWNER_MODEL_BY_TYPE[ownerType],
		publicKey: keypair.publicKey(),
		encryptedSecret: encryption.encrypt(keypair.secret()),
		network: NETWORK,
		status: 'pending',
	});

	if (NETWORK === 'testnet') {
		await fundOnTestnet(keypair.publicKey());
	} else {
		// Mainnet: the account genuinely doesn't exist on-chain yet until
		// someone sends it its first bit of XLM (the network's minimum
		// reserve). Recorded as 'pending' on purpose rather than faked as
		// active — see status field's own schema comment.
		wallet.status = 'pending';
		await wallet.save();
		return wallet;
	}

	await establishUsdcTrustline(keypair);

	wallet.status = 'active';
	await wallet.save();
	return wallet;
}

async function getWallet(ownerType, ownerId) {
	return StellarWallet.findOne({ ownerType, ownerId });
}

async function getBalances(wallet) {
	const account = await server.loadAccount(wallet.publicKey);
	return account.balances.map((b) => ({
		asset: b.asset_type === 'native' ? 'XLM' : b.asset_code,
		balance: b.balance,
	}));
}

function decryptKeypair(wallet) {
	if (!wallet.encryptedSecret) {
		throw new Error(
			'wallet.encryptedSecret is not loaded — query with .select(\'+encryptedSecret\') first'
		);
	}
	return Keypair.fromSecret(encryption.decrypt(wallet.encryptedSecret));
}

// Real Stellar multi-signature, not a Soroban contract — a school's
// finance office shouldn't have a single point-of-failure key
// controlling tuition revenue (my-todo.md Stage 6.5). Adds a co-signer
// and sets thresholds so that operations above medThreshold's weight
// (payments, by default — see Stellar's own operation-threshold table)
// require both the wallet's own key and the new signer's key.
// weight/threshold values are the caller's call, not defaulted here —
// getting multisig math wrong is exactly the kind of mistake that
// should be explicit at the call site, not silently assumed.
async function addTreasurySigner(wallet, newSignerPublicKey, { weight, medThreshold, highThreshold }) {
	const keypair = decryptKeypair(wallet);
	const account = await server.loadAccount(wallet.publicKey);
	const fee = await server.fetchBaseFee();

	const tx = new TransactionBuilder(account, {
		fee: String(fee),
		networkPassphrase: NETWORK_PASSPHRASE,
	})
		.addOperation(
			Operation.setOptions({
				signer: { ed25519PublicKey: newSignerPublicKey, weight },
				medThreshold,
				highThreshold,
			})
		)
		.setTimeout(30)
		.build();

	tx.sign(keypair);
	return server.submitTransaction(tx);
}

// Executes a real payment FROM a wallet this platform holds the key
// for — the custodial counterpart to "pay via an external wallet app
// using the QR/URI paymentService.js generates." Real use case: a
// student/parent without their own Stellar wallet app can still pay a
// fee invoice, as long as their platform wallet has a USDC balance
// (from a canteen top-up, or eventually a Stage 7 mobile-money on-ramp
// converting to USDC) — the platform signs and submits on their behalf.
async function sendPayment(fromWallet, destinationPublicKey, amountUsdc, memoText) {
	const keypair = decryptKeypair(fromWallet);
	const account = await server.loadAccount(fromWallet.publicKey);
	const fee = await server.fetchBaseFee();

	const { Memo } = require('@stellar/stellar-sdk');
	const tx = new TransactionBuilder(account, {
		fee: String(fee),
		networkPassphrase: NETWORK_PASSPHRASE,
	})
		.addOperation(
			Operation.payment({
				destination: destinationPublicKey,
				asset: usdcAsset(),
				amount: String(amountUsdc),
			})
		)
		.addMemo(Memo.text(memoText))
		.setTimeout(30)
		.build();

	tx.sign(keypair);
	return server.submitTransaction(tx);
}

module.exports = {
	getOrCreateWallet,
	getOrCreatePlatformWallet,
	PLATFORM_OWNER_ID,
	getWallet,
	getBalances,
	decryptKeypair,
	addTreasurySigner,
	sendPayment,
};
