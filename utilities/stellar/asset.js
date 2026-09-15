const { Asset } = require('@stellar/stellar-sdk');
const { NETWORK } = require('./client');

// USDC is the primary settlement asset (see my-todo.md Stage 6.1's own
// reasoning: stable, predictable invoice amounts vs. XLM's volatility).
// XLM stays available as a secondary option per-payment (Asset.native()),
// mainly because a brand-new custodial account needs a minimum XLM
// reserve to exist on-chain at all, regardless of which asset it
// actually transacts in.
//
// Real Circle-issued USDC on Stellar mainnet has one well-known,
// verifiable issuer address (confirmed against developers.circle.com
// and a public ledger explorer, not assumed from memory):
// GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN. Testnet has
// no real USDC at all — there, this platform is its own issuer, a
// keypair it controls (STELLAR_USDC_ISSUER_SECRET), the standard way to
// test a stablecoin-shaped flow before switching to the real asset on
// mainnet. Both are overridable via env var rather than hardcoded only,
// in case the issuer address ever needs to change.
const MAINNET_CIRCLE_USDC_ISSUER =
	process.env.STELLAR_USDC_ISSUER_MAINNET ||
	'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

function usdcIssuer() {
	if (NETWORK === 'mainnet') {
		return MAINNET_CIRCLE_USDC_ISSUER;
	}

	const issuer = process.env.STELLAR_USDC_ISSUER_TESTNET;
	if (!issuer) {
		throw new Error(
			'STELLAR_USDC_ISSUER_TESTNET is not set — run scripts/setup-stellar-testnet-issuer.js once and set the printed values'
		);
	}
	return issuer;
}

function usdcAsset() {
	return new Asset('USDC', usdcIssuer());
}

function nativeAsset() {
	return Asset.native();
}

// paymentMethod 'stellar' always means USDC in this codebase's own
// records (Invoice.currency, Subscription.priceXAF conversions, etc.) —
// XLM is only ever used for the minimum-reserve funding step, never as
// a settlement amount a school or student is quoted. Kept as a named
// export anyway so that decision is explicit and greppable, not
// implicit.
module.exports = { usdcAsset, nativeAsset, usdcIssuer };
