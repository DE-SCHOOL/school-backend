const {
	rpc,
	TransactionBuilder,
	Operation,
	Networks,
	Address,
	nativeToScVal,
	scValToNative,
} = require('@stellar/stellar-sdk');
const walletService = require('./walletService');
const { NETWORK } = require('./client');

// Backend integration for contracts/subscription-billing — the real,
// deployed, tested Soroban contract (see that directory's own README
// and my-todo.md Stage 6.2 for the full account of what it does and
// why it's scoped the way it is). This is the on-chain-verified
// alternative to the classic-Stellar subscription billing already
// built in paymentService.js — offered alongside it, not replacing it:
// invoking a smart contract requires the school's own wallet to sign a
// Soroban transaction, a meaningfully heavier interaction than "send a
// payment," so classic billing stays the default path for schools that
// just want to pay, and this is the opt-in "make it verifiably
// on-chain" path Stage 6.2 specifically asked for.

const RPC_URL =
	NETWORK === 'mainnet'
		? process.env.SOROBAN_RPC_URL_MAINNET || 'https://mainnet.sorobanrpc.com'
		: process.env.SOROBAN_RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org';

const rpcServer = new rpc.Server(RPC_URL);
const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

function requireContractId() {
	const id = process.env.SOROBAN_SUBSCRIPTION_CONTRACT_ID;
	if (!id) {
		throw new Error(
			'SOROBAN_SUBSCRIPTION_CONTRACT_ID is not set — deploy the contract first ' +
				'(contracts/subscription-billing, via scripts/deploy-subscription-contract.js) and set the env var to the real deployed contract ID.'
		);
	}
	return id;
}

async function submitAndWait(tx, signerKeypair) {
	const prepared = await rpcServer.prepareTransaction(tx);
	prepared.sign(signerKeypair);

	// TRY_AGAIN_LATER is a real, legitimate transient RPC response (the
	// node's submission queue is momentarily busy) — confirmed for real
	// while building this integration, not assumed. Worth a few retries
	// on its own merits, on top of (not instead of) making sure callers
	// never submit two transactions from the same source account
	// concurrently in the first place (see
	// subscription_payment.controller.js's own note on that).
	let sendResult;
	for (let attempt = 0; attempt < 5; attempt++) {
		sendResult = await rpcServer.sendTransaction(prepared);
		if (sendResult.status === 'PENDING') break;
		if (sendResult.status === 'TRY_AGAIN_LATER' && attempt < 4) {
			await new Promise((r) => setTimeout(r, 2000));
			continue;
		}
		throw new Error(`Soroban submission failed: ${JSON.stringify(sendResult)}`);
	}
	let result = await rpcServer.getTransaction(sendResult.hash);
	for (let i = 0; i < 20 && result.status === 'NOT_FOUND'; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		result = await rpcServer.getTransaction(sendResult.hash);
	}
	if (result.status !== 'SUCCESS') {
		throw new Error(`Soroban transaction ${sendResult.hash} did not succeed: ${JSON.stringify(result)}`);
	}
	return toJsonSafe(scValToNative(result.returnValue));
}

// u64/i128 contract values come back from scValToNative() as native
// BigInt — which JSON.stringify (and therefore Express's res.json())
// cannot serialize at all, a real error found by this module's own
// integration test the moment a contract-returned struct containing one
// reached an HTTP response. Every value this module returns goes
// through here so no caller has to remember to convert BigInt itself.
function toJsonSafe(value) {
	if (typeof value === 'bigint') return value.toString();
	if (Array.isArray(value)) return value.map(toJsonSafe);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonSafe(v)]));
	}
	return value;
}

async function invoke(functionName, args, signerKeypair) {
	const contractId = requireContractId();
	const account = await rpcServer.getAccount(signerKeypair.publicKey());
	const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE })
		.addOperation(Operation.invokeContractFunction({ contract: contractId, function: functionName, args }))
		.setTimeout(60)
		.build();
	return submitAndWait(tx, signerKeypair);
}

// Registers a school's subscription on-chain. Requires the school's own
// wallet to sign (walletService.decryptKeypair — the wallet document
// passed in must already have +encryptedSecret selected). Returns the
// contract's own subscription id (a u64) to store on the Subscription
// document.
async function createOnChainSubscription({
	schoolWallet,
	treasuryPublicKey,
	usdcContractId,
	amountUsdc,
	periodSeconds,
	plan,
}) {
	const keypair = walletService.decryptKeypair(schoolWallet);
	const amountStroops = BigInt(Math.round(amountUsdc * 1e7));

	const id = await invoke(
		'create_subscription',
		[
			nativeToScVal(new Address(schoolWallet.publicKey), { type: 'address' }),
			nativeToScVal(new Address(treasuryPublicKey), { type: 'address' }),
			nativeToScVal(new Address(usdcContractId), { type: 'address' }),
			nativeToScVal(amountStroops, { type: 'i128' }),
			nativeToScVal(BigInt(periodSeconds), { type: 'u64' }),
			nativeToScVal(plan, { type: 'symbol' }),
		],
		keypair
	);

	return id;
}

async function payOnChain(schoolWallet, onChainSubscriptionId) {
	const keypair = walletService.decryptKeypair(schoolWallet);
	return invoke('pay', [nativeToScVal(BigInt(onChainSubscriptionId), { type: 'u64' })], keypair);
}

// Read-only, but still a real submitted transaction (Soroban's
// simulate-only reads need a throwaway fee-payer account too, which is
// no simpler in practice than reusing the same submit path this whole
// module already has well-tested). Anyone can call this — it's public
// information by design, "verifiably on-chain" being the whole point.
async function isCurrentOnChain(schoolWallet, onChainSubscriptionId) {
	const keypair = walletService.decryptKeypair(schoolWallet);
	return invoke('is_current', [nativeToScVal(BigInt(onChainSubscriptionId), { type: 'u64' })], keypair);
}

async function getOnChainSubscription(schoolWallet, onChainSubscriptionId) {
	const keypair = walletService.decryptKeypair(schoolWallet);
	return invoke('get_subscription', [nativeToScVal(BigInt(onChainSubscriptionId), { type: 'u64' })], keypair);
}

module.exports = {
	createOnChainSubscription,
	payOnChain,
	isCurrentOnChain,
	getOnChainSubscription,
	RPC_URL,
};
