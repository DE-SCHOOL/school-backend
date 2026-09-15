#!/usr/bin/env node
// One-time operational script: creates and funds the platform's own
// test-USDC issuer account on Stellar testnet. Real USDC doesn't exist
// on testnet, so a stablecoin-shaped test asset needs an issuer this
// platform controls — this generates that keypair, funds it via
// Friendbot, and prints the env vars to set.
//
// Run once per environment: node scripts/setup-stellar-testnet-issuer.js
// Never run this for mainnet — mainnet uses the real Circle USDC issuer
// (see utilities/stellar/asset.js), there's nothing to set up there.

const { Keypair, Horizon } = require('@stellar/stellar-sdk');

async function main() {
	if (process.env.STELLAR_NETWORK === 'mainnet') {
		console.error('Refusing to run: STELLAR_NETWORK=mainnet. This script is testnet-only.');
		process.exit(1);
	}

	const server = new Horizon.Server('https://horizon-testnet.stellar.org');
	const issuer = Keypair.random();

	console.log('Funding new testnet USDC issuer account via Friendbot...');
	await server.friendbot(issuer.publicKey()).call();

	console.log('\nDone. Set these in your environment (.env, not committed — see .gitignore):\n');
	console.log(`STELLAR_USDC_ISSUER_TESTNET=${issuer.publicKey()}`);
	console.log(`STELLAR_USDC_ISSUER_TESTNET_SECRET=${issuer.secret()}`);
	console.log(
		'\nSTELLAR_USDC_ISSUER_TESTNET_SECRET is only ever used by scripts/verify-stage-6-8.js ' +
			'to pay out test USDC to newly-created wallets during their initial funding step — ' +
			'nothing in the running app itself needs it at request time.'
	);
}

main().catch((e) => {
	console.error('FAILED:', e.response?.data || e.message);
	process.exit(1);
});
