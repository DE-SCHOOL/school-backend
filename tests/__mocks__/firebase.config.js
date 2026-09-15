// Test double for firebase.config.js. Real firebase-admin/auth pulls in
// jwks-rsa -> jose, which ships ESM-only and breaks Jest's default CJS
// transform. None of the current test suite calls Firebase for real, so
// this stub avoids requiring firebase-admin at all during tests rather
// than fighting that dependency's internal module format.
exports.db = {};
exports.auth = {};
exports.messaging = {};
