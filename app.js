const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const ErrorApi = require('./utilities/ErrorApi');
const errorHandler = require('./controllers/error/error.controller');

//ROUTES
const staffRouter = require('./routes/staff routes/staff.routes');
const programRouter = require('./routes/program routes/program.routes');
const departmentRouter = require('./routes/department routes/department.routes');
const specialtyRouter = require('./routes/specialty routes/specialty.routes');
const studentRouter = require('./routes/student routes/student.routes');
const courseRouter = require('./routes/course routes/course.routes');
const staffCourseRouter = require('./routes/staff_course routes/staff_course.routes');

const app = express();

//parse the body object to express
app.use(express.json());

//parse the cookie through the cookie middleware
app.use(cookieParser());

//handle Access control origin
app.use(
	cors({
		origin: process.env.CORS_ORIGIN,
		credentials: true,
		methods: 'POST,GET,PATCH,DELETE',
		// origin: 'http://localhost:3000',
		origin: process.env.CORS_ORIGIN,
	})
);

app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/program', programRouter);
app.use('/api/v1/department', departmentRouter);
app.use('/api/v1/specialty', specialtyRouter);
app.use('/api/v1/student', studentRouter);
app.use('/api/v1/course', courseRouter);
app.use('/api/v1/staff-course', staffCourseRouter);

app.all('*', (req, res, next) => {
	const statusCode = 404;
	const message = `${req.originalUrl} not found on this server`;
	next(new ErrorApi(message, statusCode));
});

app.use(errorHandler);

module.exports = app;
