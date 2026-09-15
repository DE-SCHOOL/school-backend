#!/usr/bin/env node
// Real invocation of the deployed subscription-billing Soroban contract
// on Stellar testnet — not a local test, an actual create_subscription
// -> pay -> is_current cycle against the live contract ID written to
// contracts/.last-deploy.json by scripts/deploy-subscription-contract.js.
//
// Run: node scripts/deploy-subscription-contract.js   (once)
//      node scripts/verify-soroban-subscription.js

const fs = require('fs');
const path = require('path');
const {
	Keypair,
	Horizon,
	rpc,
	Networks,
	TransactionBuilder,
	Operation,
	Address,
	nativeToScVal,
	scValToNative,
} = require('@stellar/stellar-sdk');
const { RPC_URL, HORIZON_URL, submitAndWait } = require('./deploy-subscription-contract');

let passed = 0;
function assert(condition, message) {
	if (!condition) throw new Error(`FAILED: ${message}`);
	passed++;
	console.log(`  ok: ${message}`);
}

async function invoke(rpcServer, contractId, callerKp, fnName, args) {
	const account = await rpcServer.getAccount(callerKp.publicKey());
	const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: Networks.TESTNET })
		.addOperation(Operation.invokeContractFunction({ contract: contractId, function: fnName, args }))
		.setTimeout(60)
		.build();
	const result = await submitAndWait(rpcServer, tx, callerKp);
	return scValToNative(result.returnValue);
}

async function main() {
	const deployPath = path.join(__dirname, '..', 'contracts', '.last-deploy.json');
	if (!fs.existsSync(deployPath)) {
		console.error('contracts/.last-deploy.json not found — run scripts/deploy-subscription-contract.js first.');
		process.exit(1);
	}
	const { contractId, usdcContractId, schoolSecret, schoolPublicKey, treasuryPublicKey } = JSON.parse(
		fs.readFileSync(deployPath, 'utf8')
	);
	console.log('Contract:', contractId);

	const rpcServer = new rpc.Server(RPC_URL);
	const schoolKp = Keypair.fromSecret(schoolSecret);

	console.log('\nCalling create_subscription on the LIVE deployed contract...');
	const id = await invoke(rpcServer, contractId, schoolKp, 'create_subscription', [
		nativeToScVal(new Address(schoolPublicKey), { type: 'address' }),
		nativeToScVal(new Address(treasuryPublicKey), { type: 'address' }),
		nativeToScVal(new Address(usdcContractId), { type: 'address' }),
		nativeToScVal(350_000_000, { type: 'i128' }), // 35 USDC (7 decimals)
		nativeToScVal(2_592_000, { type: 'u64' }), // 30 days
		nativeToScVal('standard', { type: 'symbol' }),
	]);
	assert(typeof id === 'bigint' || typeof id === 'number', `create_subscription returned a real subscription id (got ${id}, type ${typeof id})`);

	console.log('\nCalling is_current before any payment...');
	const currentBefore = await invoke(rpcServer, contractId, schoolKp, 'is_current', [
		nativeToScVal(id, { type: 'u64' }),
	]);
	assert(currentBefore === false, `is_current correctly false before any payment (got ${currentBefore})`);

	console.log('\nCalling pay — a REAL on-chain USDC transfer, executed by the contract itself...');
	const nextDue = await invoke(rpcServer, contractId, schoolKp, 'pay', [nativeToScVal(id, { type: 'u64' })]);
	assert(typeof nextDue === 'bigint' || typeof nextDue === 'number', `pay returned a real next-due timestamp (got ${nextDue})`);

	console.log('\nCalling is_current after payment...');
	const currentAfter = await invoke(rpcServer, contractId, schoolKp, 'is_current', [
		nativeToScVal(id, { type: 'u64' }),
	]);
	assert(currentAfter === true, `is_current correctly true immediately after a real payment (got ${currentAfter})`);

	console.log('\nVerifying the USDC actually moved on-chain (not just contract-internal bookkeeping)...');
	const horizon = new Horizon.Server(HORIZON_URL);
	const treasuryAccount = await horizon.loadAccount(treasuryPublicKey);
	const usdcBalance = treasuryAccount.balances.find((b) => b.asset_code === 'USDC');
	assert(Boolean(usdcBalance) && Number(usdcBalance.balance) === 35, `treasury's real on-chain USDC balance is exactly 35 after the contract-executed transfer (got ${usdcBalance?.balance})`);

	console.log('\nCalling get_subscription to read the full on-chain record...');
	const sub = await invoke(rpcServer, contractId, schoolKp, 'get_subscription', [
		nativeToScVal(id, { type: 'u64' }),
	]);
	assert(sub.active === true, 'on-chain subscription record shows active: true');
	assert(sub.has_paid === true, 'on-chain subscription record shows has_paid: true');
	assert(Number(sub.amount) === 350_000_000, `on-chain record's amount matches exactly what was set at creation (got ${sub.amount})`);

	console.log(`\nALL CHECKS PASSED (${passed} assertions) — against a REAL, LIVE Soroban contract on Stellar testnet.`);
	console.log(`Contract explorer: https://stellar.expert/explorer/testnet/contract/${contractId}`);
}

main().catch((e) => {
	console.error('\n' + (e.response?.data ? JSON.stringify(e.response.data) : e.message || e));
	process.exitCode = 1;
});
