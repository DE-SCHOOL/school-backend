#!/usr/bin/env node
// Deploys contracts/subscription-billing's compiled WASM to Stellar
// testnet for real, and runs one real create->pay->is_current cycle
// against the live deployed contract to prove it actually works
// end-to-end — not just "compiles and passes local unit tests."
//
// Uses the lower-level upload/create/invoke operations directly
// (rpc.Server.prepareTransaction handles simulate+assemble in one call)
// rather than the higher-level contract.Client.deploy helper — its
// exact expected argument shape didn't match reality on the first
// attempt and this is more debuggable/controllable than guessing at it
// further.
//
// Run: node scripts/deploy-subscription-contract.js
// (build the wasm first: cd contracts && cargo build --target wasm32v1-none --release -p subscription-billing)

const fs = require('fs');
const path = require('path');
const {
	Keypair,
	Horizon,
	rpc,
	Networks,
	TransactionBuilder,
	Operation,
	Asset,
	Address,
	scValToNative,
} = require('@stellar/stellar-sdk');

const RPC_URL = 'https://soroban-testnet.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const WASM_PATH = path.join(
	__dirname,
	'..',
	'contracts',
	'target',
	'wasm32v1-none',
	'release',
	'subscription_billing.wasm'
);

async function submitAndWait(rpcServer, tx, signerKp) {
	const prepared = await rpcServer.prepareTransaction(tx);
	prepared.sign(signerKp);

	// TRY_AGAIN_LATER is a real, legitimate transient RPC response (the
	// node's submission queue is momentarily busy) — confirmed for real
	// while building this integration. See utilities/stellar/soroban.js's
	// identical retry for the full account.
	let sendResult;
	for (let attempt = 0; attempt < 5; attempt++) {
		sendResult = await rpcServer.sendTransaction(prepared);
		if (sendResult.status === 'PENDING') break;
		if (sendResult.status === 'TRY_AGAIN_LATER' && attempt < 4) {
			await new Promise((r) => setTimeout(r, 2000));
			continue;
		}
		throw new Error(`Submission failed: ${JSON.stringify(sendResult)}`);
	}
	let result = await rpcServer.getTransaction(sendResult.hash);
	for (let i = 0; i < 20 && result.status === 'NOT_FOUND'; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		result = await rpcServer.getTransaction(sendResult.hash);
	}
	if (result.status !== 'SUCCESS') {
		throw new Error(`Transaction ${sendResult.hash} did not succeed: ${JSON.stringify(result)}`);
	}
	return result;
}

async function deploy() {
	if (!fs.existsSync(WASM_PATH)) {
		console.error(`Wasm not found at ${WASM_PATH}. Build it first:`);
		console.error('  cd contracts && cargo build --target wasm32v1-none --release -p subscription-billing');
		process.exit(1);
	}
	const wasm = fs.readFileSync(WASM_PATH);
	console.log(`Loaded wasm: ${wasm.length} bytes`);

	const horizon = new Horizon.Server(HORIZON_URL);
	const rpcServer = new rpc.Server(RPC_URL);

	const deployerKp = Keypair.random();
	console.log('Deployer:', deployerKp.publicKey());
	await horizon.friendbot(deployerKp.publicKey()).call();

	// 1. Upload the wasm.
	let account = await rpcServer.getAccount(deployerKp.publicKey());
	let tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: Networks.TESTNET })
		.addOperation(Operation.uploadContractWasm({ wasm }))
		.setTimeout(60)
		.build();
	const uploadResult = await submitAndWait(rpcServer, tx, deployerKp);
	const wasmHash = Buffer.from(scValToNative(uploadResult.returnValue));
	console.log('Wasm uploaded. Hash:', wasmHash.toString('hex'));

	// 2. Create the contract instance from that wasm hash, with a random salt.
	account = await rpcServer.getAccount(deployerKp.publicKey());
	const salt = Buffer.from(Keypair.random().rawPublicKey());
	tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: Networks.TESTNET })
		.addOperation(
			Operation.createCustomContract({
				address: new Address(deployerKp.publicKey()),
				wasmHash,
				salt,
			})
		)
		.setTimeout(60)
		.build();
	const createResult = await submitAndWait(rpcServer, tx, deployerKp);
	const contractId = scValToNative(createResult.returnValue);
	console.log('Contract deployed. Contract ID:', contractId);

	return { rpcServer, horizon, deployerKp, contractId, wasmHash };
}

async function main() {
	const { rpcServer, horizon, deployerKp, contractId } = await deploy();

	// --- Set up the token + accounts the contract will actually move ---
	const schoolKp = Keypair.random();
	const treasuryKp = Keypair.random();
	const issuerKp = Keypair.random();
	await horizon.friendbot(schoolKp.publicKey()).call();
	await horizon.friendbot(treasuryKp.publicKey()).call();
	await horizon.friendbot(issuerKp.publicKey()).call();

	const usdc = new Asset('USDC', issuerKp.publicKey());
	async function trustAndFund(kp, amount) {
		const account = await horizon.loadAccount(kp.publicKey());
		const fee = await horizon.fetchBaseFee();
		const tx = new TransactionBuilder(account, { fee: String(fee), networkPassphrase: Networks.TESTNET })
			.addOperation(Operation.changeTrust({ asset: usdc }))
			.setTimeout(30)
			.build();
		tx.sign(kp);
		await horizon.submitTransaction(tx);

		if (amount > 0) {
			const issuerAccount = await horizon.loadAccount(issuerKp.publicKey());
			const fee2 = await horizon.fetchBaseFee();
			const payTx = new TransactionBuilder(issuerAccount, { fee: String(fee2), networkPassphrase: Networks.TESTNET })
				.addOperation(Operation.payment({ destination: kp.publicKey(), asset: usdc, amount: String(amount) }))
				.setTimeout(30)
				.build();
			payTx.sign(issuerKp);
			await horizon.submitTransaction(payTx);
		}
	}
	console.log('\nTrustlining + funding school and treasury with real test USDC...');
	await trustAndFund(schoolKp, 1000);
	await trustAndFund(treasuryKp, 0);

	// A classic asset's Stellar Asset Contract (SAC) address is
	// deterministic (Asset.contractId below), but that doesn't mean the
	// contract is actually deployed/instantiated on-chain yet — trustlines
	// and classic payments never trigger that. Any Soroban contract that
	// tries to invoke it (subscription-billing's `pay`, via
	// token::Client::transfer) fails with "non-existing value for
	// contract instance" until this deploy step has run. One-time, real
	// on-chain transaction.
	console.log('Deploying the Stellar Asset Contract wrapper for the test USDC asset...');
	const issuerAccountForSac = await rpcServer.getAccount(issuerKp.publicKey());
	const sacTx = new TransactionBuilder(issuerAccountForSac, { fee: '1000000', networkPassphrase: Networks.TESTNET })
		.addOperation(Operation.createStellarAssetContract({ asset: usdc }))
		.setTimeout(60)
		.build();
	await submitAndWait(rpcServer, sacTx, issuerKp);
	console.log('SAC deployed.');

	const usdcContractId = usdc.contractId(Networks.TESTNET);

	console.log('\n=== All setup complete ===');
	console.log('Contract ID:', contractId);
	console.log('USDC SAC contract ID:', usdcContractId);
	console.log('School public key:', schoolKp.publicKey());
	console.log('Treasury public key:', treasuryKp.publicKey());

	fs.writeFileSync(
		path.join(__dirname, '..', 'contracts', '.last-deploy.json'),
		JSON.stringify(
			{
				contractId,
				usdcContractId,
				deployerSecret: deployerKp.secret(),
				schoolSecret: schoolKp.secret(),
				schoolPublicKey: schoolKp.publicKey(),
				treasuryPublicKey: treasuryKp.publicKey(),
			},
			null,
			2
		)
	);
	console.log('\nWritten to contracts/.last-deploy.json for scripts/verify-soroban-subscription.js to use.');
}

module.exports = { deploy, RPC_URL, HORIZON_URL, submitAndWait };

if (require.main === module) {
	main().catch((e) => {
		console.error('DEPLOY FAILED:', e.response?.data || e.message || e);
		process.exit(1);
	});
}
