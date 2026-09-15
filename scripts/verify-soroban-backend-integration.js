#!/usr/bin/env node
// Proves the ACTUAL BACKEND API — not just the standalone Soroban
// scripts — can register a school for on-chain billing and pay through
// it for real, against a freshly deployed contracts/subscription-billing
// instance on Stellar testnet. Real HTTP requests via supertest, real
// MongoDB, real Soroban contract, real on-chain USDC transfer.
//
// Run: npm run verify:soroban-backend (takes a few minutes — several
// real Soroban/Stellar testnet transactions, each needing real ledger
// confirmation).

const mongoose = require('mongoose');
const request = require('supertest');
const testMongo = require('../tests/helpers/testMongo');
const { deploy, submitAndWait } = require('./deploy-subscription-contract');
const { Keypair, Networks, TransactionBuilder, Operation, Asset, rpc } = require('@stellar/stellar-sdk');

let passed = 0;
function assert(condition, message) {
	if (!condition) throw new Error(`FAILED: ${message}`);
	passed++;
	console.log(`  ok: ${message}`);
}

const validStaffFields = (overrides = {}) => ({
	name: 'Admin',
	email: overrides.email,
	password: 'password123',
	confirmPassword: 'password123',
	tel: overrides.tel,
	gender: 'male',
	dob: '1990-01-01',
	matricule: overrides.matricule,
	high_certificate: 'PhD',
	marital_status: 'married',
	...overrides,
});

async function main() {
	console.log('=== Deploying a fresh subscription-billing contract for this run ===');
	const { horizon, contractId } = await deploy();
	process.env.SOROBAN_SUBSCRIPTION_CONTRACT_ID = contractId;

	console.log('\n=== Setting up a throwaway test-USDC issuer + its Soroban SAC ===');
	const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
	const issuerKp = Keypair.random();
	await horizon.friendbot(issuerKp.publicKey()).call();
	const usdc = new Asset('USDC', issuerKp.publicKey());

	const issuerAccount = await rpcServer.getAccount(issuerKp.publicKey());
	const sacTx = new TransactionBuilder(issuerAccount, { fee: '1000000', networkPassphrase: Networks.TESTNET })
		.addOperation(Operation.createStellarAssetContract({ asset: usdc }))
		.setTimeout(60)
		.build();
	await submitAndWait(rpcServer, sacTx, issuerKp);
	const usdcContractId = usdc.contractId(Networks.TESTNET);
	process.env.SOROBAN_USDC_CONTRACT_ID = usdcContractId;
	console.log('USDC SAC deployed:', usdcContractId);

	const mongoHandle = await testMongo.start();
	await mongoose.connect(process.env.DATABASE);

	process.env.JWT_SECRET = 'test-jwt-secret';
	process.env.JWT_SECRET_STUDENT = 'test-jwt-secret-student';
	process.env.JWT_SECRET_PLATFORM = 'test-jwt-secret-platform';
	process.env.JWT_SECRET_PERSON = 'test-jwt-secret-person';
	process.env.JWT_EXPIRES_IN = '1d';
	process.env.COOKIE_EXP = '1';
	process.env.RATE_LIMIT_ATTEMPTS = '2000';
	process.env.STELLAR_KEY_ENCRYPTION_SECRET = 'test-key-encryption-secret-for-this-run-only';
	process.env.STELLAR_USDC_ISSUER_TESTNET = issuerKp.publicKey();
	if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
		const { generateKeyPairSync } = require('crypto');
		const { privateKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
			publicKeyEncoding: { type: 'spki', format: 'pem' },
		});
		process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
			type: 'service_account',
			project_id: 'test-project',
			private_key_id: 'x',
			private_key: privateKey,
			client_email: 'test@test-project.iam.gserviceaccount.com',
			client_id: '1',
			token_uri: 'https://oauth2.googleapis.com/token',
		});
	}

	const app = require('../app');
	const PlatformStaff = require('../models/platform_staff.model');
	const Subscription = require('../models/subscription.model');

	try {
		await PlatformStaff.create({
			name: 'Founder',
			email: 'founder@deschool.cm',
			password: 'superSecret123',
			role: 'super_admin',
		});
		const platformLogin = await request(app).post('/api/v1/platform/login').send({
			email: 'founder@deschool.cm',
			password: 'superSecret123',
		});
		const platformToken = platformLogin.body.data.token;

		console.log('\n=== Creating a real school through the actual backend API ===');
		const schoolRes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'GTTC Buea',
				slug: 'gttc-buea',
				contactEmail: 'contact@gttc.cm',
				firstAdmin: validStaffFields({ email: 'admin@gttc.cm', matricule: 'ADM-001', tel: '677111111' }),
			});
		assert(schoolRes.status === 201, `school created (got ${schoolRes.status})`);
		const schoolId = schoolRes.body.data._id;

		const adminLogin = await request(app).post('/api/v1/staff/login').send({ email: 'admin@gttc.cm', password: 'password123' });
		const staffToken = adminLogin.body.data.token;

		const schoolWalletRes = await request(app).get(`/api/v1/stellar/wallet/school/${staffToken}`);
		assert(schoolWalletRes.status === 200 && schoolWalletRes.body.data.status === 'active', `school wallet auto-provisioned and active (got ${schoolWalletRes.status})`);
		const schoolPublicKey = schoolWalletRes.body.data.publicKey;

		// The contract's `pay` executes a REAL token transfer from the
		// school's own wallet — it needs a real USDC balance to pay with,
		// same as any other Stellar account. Minting some in, standing in
		// for however that balance really got there in production (a
		// classic USDC payment in, or a future Stage 7 on-ramp).
		console.log('\nFunding the real school wallet with test USDC so it can actually pay on-chain...');
		const trustAccount = await horizon.loadAccount(schoolPublicKey);
		const fee = await horizon.fetchBaseFee();
		const trustTx = new TransactionBuilder(trustAccount, { fee: String(fee), networkPassphrase: Networks.TESTNET })
			.addOperation(Operation.changeTrust({ asset: usdc }))
			.setTimeout(30)
			.build();
		// The school wallet's secret lives encrypted in our own DB — reuse
		// the same decryption path the app itself uses, rather than a
		// second, parallel way of getting at it.
		const walletService = require('../utilities/stellar/walletService');
		const StellarWallet = require('../models/stellar_wallet.model');
		const schoolWalletDoc = await StellarWallet.findOne({ ownerType: 'school', ownerId: schoolId }).select('+encryptedSecret');
		const schoolKeypair = walletService.decryptKeypair(schoolWalletDoc);
		trustTx.sign(schoolKeypair);
		await horizon.submitTransaction(trustTx);

		const issuerAccount2 = await horizon.loadAccount(issuerKp.publicKey());
		const fee2 = await horizon.fetchBaseFee();
		const mintTx = new TransactionBuilder(issuerAccount2, { fee: String(fee2), networkPassphrase: Networks.TESTNET })
			.addOperation(Operation.payment({ destination: schoolPublicKey, asset: usdc, amount: '1000' }))
			.setTimeout(30)
			.build();
		mintTx.sign(issuerKp);
		await horizon.submitTransaction(mintTx);
		console.log('School wallet funded with 1000 test USDC.');

		console.log('\n=== Registering the school for on-chain billing via the real backend endpoint ===');
		const registerRes = await request(app).post(`/api/v1/stellar/subscription/on-chain/register/${staffToken}`);
		assert(registerRes.status === 200, `on-chain registration succeeds (got ${registerRes.status}, body: ${JSON.stringify(registerRes.body)})`);
		assert(Boolean(registerRes.body.data.onChainSubscriptionId), 'a real on-chain subscription id came back');

		const subAfterRegister = await Subscription.findOne({ schoolId });
		assert(subAfterRegister.onChainSubscriptionId === registerRes.body.data.onChainSubscriptionId, "the id is persisted on the school's own Subscription document");

		const doubleRegisterRes = await request(app).post(`/api/v1/stellar/subscription/on-chain/register/${staffToken}`);
		assert(doubleRegisterRes.status === 400, `registering twice is correctly rejected (got ${doubleRegisterRes.status})`);

		console.log('\n=== Checking on-chain status BEFORE paying — through the real backend endpoint ===');
		const statusBefore = await request(app).get(`/api/v1/stellar/subscription/on-chain/status/${staffToken}`);
		assert(statusBefore.status === 200, `status check succeeds (got ${statusBefore.status}, body: ${JSON.stringify(statusBefore.body)})`);
		assert(statusBefore.body.data.isCurrent === false, `correctly not current before any on-chain payment (got ${statusBefore.body.data.isCurrent})`);

		console.log('\n=== Paying on-chain through the real backend endpoint (a real Soroban transaction, signed with the school\'s own custodial key) ===');
		const payRes = await request(app).post(`/api/v1/stellar/subscription/on-chain/pay/${staffToken}`);
		assert(payRes.status === 200, `on-chain payment succeeds (got ${payRes.status}, body: ${JSON.stringify(payRes.body)})`);
		assert(Boolean(payRes.body.data.nextDueAt), 'a real next-due date came back');

		const subAfterPay = await Subscription.findOne({ schoolId });
		assert(subAfterPay.status === 'active', `Subscription status flipped to active (got ${subAfterPay.status})`);

		console.log('\n=== Checking on-chain status AFTER paying ===');
		const statusAfter = await request(app).get(`/api/v1/stellar/subscription/on-chain/status/${staffToken}`);
		assert(statusAfter.body.data.isCurrent === true, `correctly current immediately after the real on-chain payment (got ${statusAfter.body.data.isCurrent})`);
		assert(statusAfter.body.data.record.has_paid === true, "the real on-chain contract record itself shows has_paid: true — read straight from the deployed contract, not this app's own database");

		console.log(`\nALL CHECKS PASSED (${passed} assertions) — real backend API, real deployed Soroban contract, real on-chain USDC transfer.`);
		process.exitCode = 0;
	} catch (err) {
		console.error('\n' + err.message);
		process.exitCode = 1;
	} finally {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
		await mongoHandle.stop();
	}
}

main();
