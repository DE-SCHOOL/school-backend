#!/usr/bin/env node
// Writes firebase-service-account.local.json (gitignored) if it doesn't
// already exist, so a contributor never needs a real Firebase project
// just to boot the app and log in. This is the same disposable,
// self-signed key trick every verify:* script already uses — real for
// firebase-admin's purposes (initializeApp/cert accept it, and
// auth.createCustomToken(), which staff login calls, only signs a JWT
// locally with this key, no network round-trip to Firebase at all) but
// not connected to any real Firebase project, so anything that actually
// talks to Firestore/Messaging (chat, push notifications) will not
// work until a real project's credentials are supplied instead.
//
// Usage: node scripts/generate-dev-firebase-key.js

const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

const OUT_PATH = path.join(__dirname, '..', 'firebase-service-account.local.json');

if (fs.existsSync(OUT_PATH)) {
	console.log('[dev-firebase-key] firebase-service-account.local.json already exists, leaving it alone');
	process.exit(0);
}

const { privateKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
	publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const serviceAccount = {
	type: 'service_account',
	project_id: 'de-school-dev',
	private_key_id: 'dev-key',
	private_key: privateKey,
	client_email: 'dev@de-school-dev.iam.gserviceaccount.com',
	client_id: '1',
	token_uri: 'https://oauth2.googleapis.com/token',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(serviceAccount, null, 2));
console.log(`[dev-firebase-key] wrote a disposable dev key to ${OUT_PATH}`);
console.log('[dev-firebase-key] not a real Firebase project — login works, Firestore chat/push notifications will not.');
console.log('[dev-firebase-key] replace with real Firebase credentials (FIREBASE_SERVICE_ACCOUNT_JSON) when you need those features.');
