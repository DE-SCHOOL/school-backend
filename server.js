const mongoose = require('mongoose');
const app = require('./app');

const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

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
