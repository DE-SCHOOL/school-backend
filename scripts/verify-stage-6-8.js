#!/usr/bin/env node
// Standalone integration verification for Stage 6 (Stellar payments)
// and Stage 8 (canteen) — real HTTP requests via supertest, a real
// disposable MongoDB replica set, AND real transactions against actual
// Stellar testnet (not mocked, not simulated). Same approach as
// scripts/verify-tenant-isolation.js and verify-stage-4-5.js — see the
// former's header comment for why this is a plain Node script, not
// Jest.
//
// This script generates and funds its own throwaway test-USDC issuer
// at the start of each run (mirroring how it spins up its own
// throwaway MongoDB) rather than depending on
// scripts/setup-stellar-testnet-issuer.js having been run first —
// keeps this fully self-contained and reproducible.
//
// Run: npm run verify:stage-6-8 (takes 1-3 minutes — every payment
// below is a real Stellar testnet transaction, each needing a real
// ~5s ledger close to confirm).

const mongoose = require('mongoose');
const request = require('supertest');
const testMongo = require('../tests/helpers/testMongo');

let passed = 0;

function assert(condition, message) {
	if (!condition) {
		throw new Error(`FAILED: ${message}`);
	}
	passed++;
	console.log(`  ok: ${message}`);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Horizon's core ledger confirms a submitted transaction synchronously
// (submitTransaction only returns once it's actually in a closed
// ledger), but Horizon's own derived indexes — the payments() endpoint
// this whole reconciliation mechanism depends on — are populated by a
// separate ingestion pipeline that can lag slightly behind, especially
// on testnet. Reconciling once right after a payment is genuinely not
// reliable; polling a few times is the honest way to handle that real
// eventual-consistency window rather than assuming instant availability.
async function reconcileUntil(reconcileFn, checkFn, { retries = 6, delayMs = 3000 } = {}) {
	for (let i = 0; i < retries; i++) {
		await reconcileFn();
		if (await checkFn()) return true;
		await sleep(delayMs);
	}
	return checkFn();
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

const validStudentFields = (overrides = {}) => ({
	name: 'Student One',
	matricule: overrides.matricule,
	address: 'Buea',
	gender: 'male',
	dob: '2008-05-12',
	parent_name: 'Parent One',
	parent_tel: '677001122',
	level: 100,
	...overrides,
});

async function main() {
	const mongoHandle = await testMongo.start();
	await mongoose.connect(process.env.DATABASE);

	process.env.JWT_SECRET = 'test-jwt-secret';
	process.env.JWT_SECRET_STUDENT = 'test-jwt-secret-student';
	process.env.JWT_SECRET_PLATFORM = 'test-jwt-secret-platform';
	process.env.JWT_SECRET_PERSON = 'test-jwt-secret-person';
	process.env.JWT_EXPIRES_IN = '1d';
	process.env.COOKIE_EXP = '1';
	process.env.RATE_LIMIT_ATTEMPTS = '5000';
	process.env.STELLAR_KEY_ENCRYPTION_SECRET = 'test-key-encryption-secret-for-this-run-only';
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

	console.log('\n=== Setting up a throwaway testnet USDC issuer for this run ===');
	const { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset, Memo } = require('@stellar/stellar-sdk');
	const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
	const issuerKp = Keypair.random();
	await horizon.friendbot(issuerKp.publicKey()).call();
	process.env.STELLAR_USDC_ISSUER_TESTNET = issuerKp.publicKey();
	console.log('  Issuer funded:', issuerKp.publicKey());

	// A real external payer wallet — standing in for a parent/donor using
	// their own (non-custodial) Stellar wallet app, entirely separate from
	// any wallet this platform itself generates/holds.
	async function createFundedTestUsdcPayer(usdcAmount) {
		const kp = Keypair.random();
		await horizon.friendbot(kp.publicKey()).call();
		const usdc = new Asset('USDC', issuerKp.publicKey());

		const account = await horizon.loadAccount(kp.publicKey());
		const fee = await horizon.fetchBaseFee();
		const trustTx = new TransactionBuilder(account, { fee: String(fee), networkPassphrase: Networks.TESTNET })
			.addOperation(Operation.changeTrust({ asset: usdc }))
			.setTimeout(30)
			.build();
		trustTx.sign(kp);
		await horizon.submitTransaction(trustTx);

		const issuerAccount = await horizon.loadAccount(issuerKp.publicKey());
		const fee2 = await horizon.fetchBaseFee();
		const payTx = new TransactionBuilder(issuerAccount, { fee: String(fee2), networkPassphrase: Networks.TESTNET })
			.addOperation(Operation.payment({ destination: kp.publicKey(), asset: usdc, amount: String(usdcAmount) }))
			.setTimeout(30)
			.build();
		payTx.sign(issuerKp);
		await horizon.submitTransaction(payTx);

		return kp;
	}

	async function payInvoiceFromExternalWallet(payerKp, destinationPublicKey, amountUsdc, memoText) {
		const usdc = new Asset('USDC', issuerKp.publicKey());
		const account = await horizon.loadAccount(payerKp.publicKey());
		const fee = await horizon.fetchBaseFee();
		const tx = new TransactionBuilder(account, { fee: String(fee), networkPassphrase: Networks.TESTNET })
			.addOperation(Operation.payment({ destination: destinationPublicKey, asset: usdc, amount: String(amountUsdc) }))
			.addMemo(Memo.text(memoText))
			.setTimeout(30)
			.build();
		tx.sign(payerKp);
		return horizon.submitTransaction(tx);
	}

	const app = require('../app');
	const PlatformStaff = require('../models/platform_staff.model');
	const Staff = require('../models/staff.model');
	const Invoice = require('../models/invoice.model');
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

		console.log('\n=== Stage 6.1/6.2: school wallet provisioning + subscription payment ===');

		const schoolRes = await request(app)
			.post(`/api/v1/platform/schools/${platformToken}`)
			.send({
				name: 'GTTC Buea',
				slug: 'gttc-buea',
				contactEmail: 'contact@gttc.cm',
				firstAdmin: validStaffFields({ email: 'admin@gttc.cm', matricule: 'ADM-001', tel: '677111111' }),
			});
		assert(schoolRes.status === 201, `school created (got ${schoolRes.status}, body: ${JSON.stringify(schoolRes.body)})`);
		const schoolId = schoolRes.body.data._id;

		const adminLogin = await request(app).post('/api/v1/staff/login').send({ email: 'admin@gttc.cm', password: 'password123' });
		const staffToken = adminLogin.body.data.token;

		const schoolWalletRes = await request(app).get(`/api/v1/stellar/wallet/school/${staffToken}`);
		assert(schoolWalletRes.status === 200, `school wallet auto-provisioned (got ${schoolWalletRes.status}, body: ${JSON.stringify(schoolWalletRes.body)})`);
		assert(schoolWalletRes.body.data.status === 'active', `school wallet is active (funded + trustline) (got ${schoolWalletRes.body.data.status})`);
		const schoolPublicKey = schoolWalletRes.body.data.publicKey;
		assert(schoolPublicKey.startsWith('G'), 'school wallet has a real Stellar public key');

		const subInvoiceRes = await request(app)
			.post(`/api/v1/stellar/subscription/${schoolId}/invoice/${platformToken}`)
			.send({});
		assert(subInvoiceRes.status === 201, `subscription invoice created (got ${subInvoiceRes.status}, body: ${JSON.stringify(subInvoiceRes.body)})`);
		assert(Boolean(subInvoiceRes.body.data.paymentUri), 'subscription invoice includes a real payment URI');
		const subMemo = subInvoiceRes.body.data.invoice.memo;
		const subAmountUsdc = subInvoiceRes.body.data.invoice.amountUsdc;

		const platformWalletRes = await request(app).get(`/api/v1/platform/schools/${schoolId}/${platformToken}`);
		// Platform wallet's own public key isn't directly exposed by that
		// endpoint — fetch it straight from the DB instead, same as the
		// reconciliation controllers do internally.
		const StellarWallet = require('../models/stellar_wallet.model');
		const platformWallet = await StellarWallet.findOne({ ownerType: 'platform' });
		assert(Boolean(platformWallet) && platformWallet.status === 'active', 'platform treasury wallet auto-provisioned and active');

		console.log('  Paying the subscription invoice from a real external testnet wallet...');
		const schoolPayer = await createFundedTestUsdcPayer(subAmountUsdc * 2);
		await payInvoiceFromExternalWallet(schoolPayer, platformWallet.publicKey, subAmountUsdc, subMemo);

		let reconcileSubRes;
		await reconcileUntil(
			async () => {
				reconcileSubRes = await request(app).post(`/api/v1/stellar/subscription/reconcile/${platformToken}`);
			},
			async () => (await Invoice.findById(subInvoiceRes.body.data.invoice._id).setOptions({ skipTenantScope: true })).status === 'paid'
		);
		assert(reconcileSubRes.status === 200, `subscription reconciliation runs (got ${reconcileSubRes.status}, body: ${JSON.stringify(reconcileSubRes.body)})`);

		const paidSubInvoice = await Invoice.findById(subInvoiceRes.body.data.invoice._id).setOptions({ skipTenantScope: true });
		assert(paidSubInvoice.status === 'paid', `subscription invoice status flipped to 'paid' automatically (got ${paidSubInvoice.status})`);
		assert(paidSubInvoice.payments[0].stellarTxHash.length === 64, 'a real 64-char Stellar transaction hash was recorded against the invoice');

		const subscriptionAfter = await Subscription.findOne({ schoolId });
		assert(subscriptionAfter.status === 'active', `Subscription status is 'active' after payment (got ${subscriptionAfter.status})`);
		assert(subscriptionAfter.currentPeriodEnd > new Date(), 'Subscription currentPeriodEnd was extended into the future');

		console.log('\n=== Stage 6.5: real multi-signature treasury ===');
		const coSigner = Keypair.random();
		const signerRes = await request(app)
			.post(`/api/v1/stellar/wallet/school/treasury-signer/${staffToken}`)
			.send({ signerPublicKey: coSigner.publicKey(), weight: 1, medThreshold: 2, highThreshold: 2 });
		assert(signerRes.status === 200, `treasury co-signer added (got ${signerRes.status}, body: ${JSON.stringify(signerRes.body)})`);

		const schoolAccountOnChain = await horizon.loadAccount(schoolPublicKey);
		assert(schoolAccountOnChain.signers.length === 2, `school account now really has 2 signers on-chain (got ${schoolAccountOnChain.signers.length})`);
		assert(schoolAccountOnChain.thresholds.med_threshold === 2, 'medThreshold really set to 2 on-chain — a payment now needs both signers');

		console.log('\n=== Stage 6.3: student fee payment, partial + scholarship-style third-party payment ===');

		// Build the Program -> Department -> Specialty -> Student chain
		// (same as Stage 5's verification script).
		const program = await request(app).post(`/api/v1/program/${staffToken}`).send({ name: 'Program A', director: adminLogin.body.data._id, deputyDirector: adminLogin.body.data._id });
		const department = await request(app).post(`/api/v1/department/${staffToken}`).send({ name: 'Department A', hod: adminLogin.body.data._id, program: program.body.data._id });
		const specialty = await request(app).post(`/api/v1/specialty/${staffToken}`).send({ name: 'Specialty A', department: department.body.data._id, level: 100 });
		const academicYear = await request(app).post(`/api/v1/academic-year/${staffToken}`).send({ academicYear: '2024/2025' });

		const studentRes = await request(app)
			.post(`/api/v1/student/academic-year/${academicYear.body.data._id}/${staffToken}`)
			.send(validStudentFields({ matricule: 'STU-001', specialty: specialty.body.data._id }));
		assert(studentRes.status === 201, `student created (got ${studentRes.status})`);
		const studentId = studentRes.body.data._id;

		// Confirm the entitlement gate is real before upgrading the plan.
		const gatedFeeRes = await request(app)
			.post(`/api/v1/stellar/fees/${staffToken}`)
			.send({ studentId, description: 'Term 1 fees', amountXAF: 50000 });
		assert(gatedFeeRes.status === 403, `starter-plan school is correctly BLOCKED from creating a fee invoice (got ${gatedFeeRes.status})`);

		const upgradeRes = await request(app)
			.patch(`/api/v1/platform/schools/${schoolId}/subscription/${platformToken}`)
			.send({ plan: 'standard' });
		assert(upgradeRes.status === 200, `school upgraded to standard plan (got ${upgradeRes.status})`);

		const feeInvoiceRes = await request(app)
			.post(`/api/v1/stellar/fees/${staffToken}`)
			.send({ studentId, description: 'Term 1 fees', amountXAF: 50000 });
		assert(feeInvoiceRes.status === 201, `fee invoice created after upgrade (got ${feeInvoiceRes.status}, body: ${JSON.stringify(feeInvoiceRes.body)})`);
		const feeMemo = feeInvoiceRes.body.data.memo;
		const feeAmountUsdc = feeInvoiceRes.body.data.amountUsdc;
		const feeInvoiceId = feeInvoiceRes.body.data._id;

		const payInfoRes = await request(app).get(`/api/v1/stellar/invoices/${feeMemo}/pay-info`);
		assert(payInfoRes.status === 200, `PUBLIC (no auth) pay-info lookup works for a donor/scholarship payer (got ${payInfoRes.status})`);
		assert(payInfoRes.body.data.paymentUri.includes(schoolPublicKey), 'public pay-info returns a real payment URI to the real school wallet');

		console.log('  Paying half the fee from a real external testnet wallet (installment 1 of 2)...');
		const feePayer = await createFundedTestUsdcPayer(feeAmountUsdc * 2);
		const halfAmount = Number((feeAmountUsdc / 2).toFixed(7));
		await payInvoiceFromExternalWallet(feePayer, schoolPublicKey, halfAmount, feeMemo);

		let reconcile1;
		await reconcileUntil(
			async () => {
				reconcile1 = await request(app).post(`/api/v1/stellar/fees/reconcile/${staffToken}`);
			},
			async () => (await Invoice.findById(feeInvoiceId).setOptions({ skipTenantScope: true })).status !== 'pending'
		);
		assert(reconcile1.status === 200, `first fee reconciliation runs (got ${reconcile1.status})`);

		const afterHalf = await Invoice.findById(feeInvoiceId).setOptions({ skipTenantScope: true });
		assert(afterHalf.status === 'partially_paid', `invoice correctly shows 'partially_paid' after a partial payment (got ${afterHalf.status})`);

		console.log('  A DIFFERENT wallet (standing in for a scholarship donor) pays the remainder...');
		const donorPayer = await createFundedTestUsdcPayer(feeAmountUsdc);
		await payInvoiceFromExternalWallet(donorPayer, schoolPublicKey, halfAmount, feeMemo);

		let reconcile2;
		await reconcileUntil(
			async () => {
				reconcile2 = await request(app).post(`/api/v1/stellar/fees/reconcile/${staffToken}`);
			},
			async () => (await Invoice.findById(feeInvoiceId).setOptions({ skipTenantScope: true })).status === 'paid'
		);
		assert(reconcile2.status === 200, 'second fee reconciliation runs');

		const afterFull = await Invoice.findById(feeInvoiceId).setOptions({ skipTenantScope: true });
		assert(afterFull.status === 'paid', `invoice correctly shows 'paid' once fully settled across two different payers (got ${afterFull.status})`);
		assert(afterFull.payments.length === 2, `both installments recorded as separate real payments (got ${afterFull.payments.length})`);
		assert(afterFull.payments[0].fromPublicKey !== afterFull.payments[1].fromPublicKey, 'the two payments are correctly attributed to two DIFFERENT real Stellar accounts — a genuine multi-payer/scholarship trail');

		console.log('\n=== Stage 8: canteen ===');

		const itemRes = await request(app).post(`/api/v1/canteen/items/${staffToken}`).send({ name: 'Meat pie', priceXAF: 500 });
		assert(itemRes.status === 201, `canteen item created (standard plan has the entitlement now) (got ${itemRes.status}, body: ${JSON.stringify(itemRes.body)})`);
		const itemId = itemRes.body.data._id;

		const personSignup = await request(app).post('/api/v1/person/signup').send({
			name: 'Real Student', email: 'student@example.cm', password: 'password123', confirmPassword: 'password123',
		});
		const personLogin = await request(app).post('/api/v1/person/login').send({ email: 'student@example.cm', password: 'password123' });
		const personToken = personLogin.body.data.token;

		const linkRes = await request(app)
			.post(`/api/v1/person/link-enrollment/${personToken}`)
			.send({ schoolSlug: 'gttc-buea', matricule: 'STU-001', dob: studentRes.body.data.dob });
		assert(linkRes.status === 200, `Person links the student enrollment (got ${linkRes.status})`);

		const topUpRes = await request(app)
			.post(`/api/v1/canteen/topup/${personToken}`)
			.send({ studentId, amountXAF: 5000 });
		assert(topUpRes.status === 201, `canteen top-up invoice created (got ${topUpRes.status}, body: ${JSON.stringify(topUpRes.body)})`);
		const topUpMemo = topUpRes.body.data.invoice.memo;
		const topUpAmountUsdc = topUpRes.body.data.invoice.amountUsdc;

		console.log('  Paying the canteen top-up from a real external testnet wallet...');
		const topUpPayer = await createFundedTestUsdcPayer(topUpAmountUsdc * 2);
		await payInvoiceFromExternalWallet(topUpPayer, schoolPublicKey, topUpAmountUsdc, topUpMemo);

		const CanteenAccount = require('../models/canteen_account.model');
		let reconcileTopUp;
		await reconcileUntil(
			async () => {
				reconcileTopUp = await request(app).post(`/api/v1/stellar/fees/reconcile/${staffToken}`);
			},
			async () => {
				const acct = await CanteenAccount.findOne({ studentId }).setOptions({ skipTenantScope: true });
				return Boolean(acct) && acct.balanceXAF >= 5000;
			}
		);
		assert(reconcileTopUp.status === 200, 'canteen top-up reconciliation runs (shares the school wallet reconcile endpoint with fee payments)');

		const balanceRes = await request(app).get(`/api/v1/canteen/balance/${studentId}/${personToken}`);
		assert(balanceRes.status === 200, `Person can check their own canteen balance (got ${balanceRes.status})`);
		assert(balanceRes.body.data.balanceXAF === 5000, `canteen balance correctly credited to 5000 XAF from the real Stellar payment (got ${balanceRes.body.data.balanceXAF})`);

		const purchaseRes = await request(app)
			.post(`/api/v1/canteen/purchase/${staffToken}`)
			.send({ studentId, items: [{ canteenItemId: itemId, qty: 2 }] });
		assert(purchaseRes.status === 201, `canteen purchase succeeds (got ${purchaseRes.status}, body: ${JSON.stringify(purchaseRes.body)})`);
		assert(purchaseRes.body.data.amountXAF === 1000, `purchase total correctly computed (2 x 500) (got ${purchaseRes.body.data.amountXAF})`);
		assert(purchaseRes.body.data.balanceAfter === 4000, `balance correctly deducted off-chain, instantly, no on-chain wait (got ${purchaseRes.body.data.balanceAfter})`);

		const overspendRes = await request(app)
			.post(`/api/v1/canteen/purchase/${staffToken}`)
			.send({ studentId, items: [{ canteenItemId: itemId, qty: 100 }] });
		assert(overspendRes.status === 402, `purchase exceeding balance is correctly rejected (got ${overspendRes.status})`);

		const ledgerRes = await request(app).get(`/api/v1/canteen/ledger/${studentId}/${staffToken}`);
		assert(ledgerRes.status === 200, `canteen ledger readable (got ${ledgerRes.status})`);
		assert(ledgerRes.body.data.length === 2, `ledger shows both the top-up and the purchase, in order (got ${ledgerRes.body.data.length})`);
		assert(ledgerRes.body.data[0].type === 'purchase' && ledgerRes.body.data[1].type === 'topup', 'ledger sorted newest-first, correct types');

		console.log(`\nALL CHECKS PASSED (${passed} assertions)`);
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
