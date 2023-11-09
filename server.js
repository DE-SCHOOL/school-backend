const mongoose = require('mongoose');
const app = require('./app');

const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

mongoose
	.connect(process.env.DATABASE, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => console.log('Connected to database LMU'))
	.catch((err) => console.log('ERROR: ', err));

app.listen(process.env.PORT, () => {
	console.log('App running on port', process.env.PORT);
});
