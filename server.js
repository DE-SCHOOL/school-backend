const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

// dotenv.config() has to run before requiring app.js (and everything it
// requires), not just before mongoose.connect() below — a real bug found
// while adding LEGACY_ALLOWED_ORIGINS: utilities/corsOrigin.js reads
// process.env.LEGACY_ALLOWED_ORIGINS at module-load time (not per
// request), so with the old require order that module evaluated before
// .env was ever loaded, silently freezing in the hardcoded fallback
// origin forever regardless of what .env actually configured. Tests
// (tests/app.test.js) never caught this because jest sets its own env
// vars directly rather than going through server.js's require order at
// all — only running the real server surfaced it.
const mongoose = require('mongoose');
const app = require('./app');

mongoose
	.connect(process.env.DATABASE)
	.then(() => console.log('Connected to school DB'))
	.catch((err) => console.log('ERROR: ', err));

app.listen(process.env.PORT, () => {
	console.log('App running on port', process.env.PORT);
});

// Notifications Handler — lives here, not in app.js, so that requiring
// app.js alone (tests, tooling) never opens a live Firestore listener.
app.listenToNewMessageAlert();
