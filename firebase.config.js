const admin = require('firebase-admin');
const serviceAccount = require('./school-mobile-app-34c3f-firebase-adminsdk-2ldmk-751f32ddfb.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

exports.db = admin.firestore();
exports.auth = admin.auth();
exports.messaging = admin.messaging();
