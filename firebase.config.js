const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');

function loadServiceAccount() {
	if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
		return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
	}

	// Local-dev fallback only. Never commit the key file this loads —
	// see .gitignore. Production must set FIREBASE_SERVICE_ACCOUNT_JSON.
	return require('./firebase-service-account.local.json');
}

const app = initializeApp({
	credential: cert(loadServiceAccount()),
});

exports.db = getFirestore(app);
exports.auth = getAuth(app);
exports.messaging = getMessaging(app);
