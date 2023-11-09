const express = require('express');
const cors = require('cors');
const ErrorApi = require('./utilities/ErrorApi');
const errorHandler = require('./controllers/error/error.controller');

//ROUTES
const staffRouter = require('./routes/staff routes/staff.routes');
const programRouter = require('./routes/program routes/program.routes');
const departmentRouter = require('./routes/department routes/department.routes');
const specialtyRouter = require('./routes/specialty routes/specialty.routes');
const studentRouter = require('./routes/student routes/student.routes');

const app = express();

//parse the body object to express
app.use(express.json());

app.use(cors());
app.use((req, res, next) => {
	// console.log(req.headers.origin, 1234);
	res.header('Access-Control-Allow-Origin', 'http://localhost:3000');

	next();
});

app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/program', programRouter);
app.use('/api/v1/department', departmentRouter);
app.use('/api/v1/specialty', specialtyRouter);
app.use('/api/v1/student', studentRouter);

app.all('*', (req, res, next) => {
	const statusCode = 404;
	const message = `${req.originalUrl} not found on this server`;
	next(new ErrorApi(message, statusCode));
});

app.use(errorHandler);

module.exports = app;
