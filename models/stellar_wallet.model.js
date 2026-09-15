const mongoose = require('mongoose');

// Custodial Stellar account, generated and held server-side (see
// my-todo.md Stage 6.1: "most Cameroonian school administrators will
// not have a personal Stellar wallet already" — non-custodial/
// wallet-connect is a real fast-follow, not day one).
//
// Deliberately NOT run through tenantScope.plugin.js. A wallet's owner
// is polymorphic (a School OR a Person — a Person's wallet, like Person
// itself, belongs to no single school), so "school-scoped by default"
// isn't even a coherent default here; every query goes through
// walletService.js instead, explicit about which owner it means.
const stellarWalletSchema = new mongoose.Schema({
	ownerType: {
		type: String,
		enum: {
			// 'platform' is the one singleton treasury wallet subscription
			// payments settle into — see walletService.js's PLATFORM_OWNER_ID.
			values: ['school', 'person', 'platform'],
			message: 'ownerType must be school, person, or platform',
		},
		required: [true, 'A wallet must have an ownerType'],
	},
	ownerId: {
		type: mongoose.Schema.Types.ObjectId,
		required: [true, 'A wallet must have an ownerId'],
		index: true,
		// refPath lets this resolve to the right collection for
		// .populate() when ownerType is school/person; 'platform' has no
		// backing collection to populate against (it's a fixed sentinel
		// id, not a real document) and is simply never populated.
		refPath: 'ownerModel',
	},
	ownerModel: {
		type: String,
		required: true,
		enum: ['school', 'person', 'platform'],
	},
	publicKey: {
		type: String,
		required: [true, 'A wallet must have a public key'],
		unique: true,
	},
	// AES-256-GCM ciphertext (utilities/encryption.js), never the raw
	// secret seed. select: false so an accidental `Wallet.find({})` in
	// some future controller can never leak it into an API response —
	// callers that genuinely need to sign a transaction must explicitly
	// .select('+encryptedSecret').
	encryptedSecret: {
		type: String,
		required: [true, 'A wallet must have an encrypted secret'],
		select: false,
	},
	network: {
		type: String,
		enum: ['testnet', 'mainnet'],
		required: [true, 'A wallet must record which network it was created on'],
	},
	status: {
		type: String,
		enum: {
			values: ['pending', 'active'],
			message: 'status must be pending or active',
		},
		default: 'pending',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

stellarWalletSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

const StellarWallet = mongoose.model('stellar_wallet', stellarWalletSchema);
module.exports = StellarWallet;
