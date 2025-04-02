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
const markRouter = require('./routes/mark routes/mark.routes');
const attendanceRouter = require('./routes/attendance routes/attendance.routes');
const questionCategoryRouter = require('./routes/question routes/question_category.routes');
const questionRouter = require('./routes/question routes/question.routes');
const reviewRouter = require('./routes/review routes/review.routes');
const academicYearRouter = require('./routes/academic_year routes/academic_year.routes');
const studentAcademicYearRouter = require('./routes/academic_year routes/student_academic_year.routes');
const studentAppRouter = require('./routes/mobile routes/mobile.student.routes');
// const smsRouter = require('./routes/sms routes/sms.routes');
const timetableRouter = require('./routes/timetable routes/timetable.routes');
const formBRouter = require('./routes/form_b routes/formb.routes');
const listenToNewMessageAlert = require('./controllers/notification controllers/notification');
const app = express();

//parse the body object to express
app.use(express.json());

//handle Access control origin
app.use(
	cors({
		credentials: true,
		methods: 'POST,GET,PATCH,DELETE',
		origin: 'https://gttcbuea.onrender.com',
		// origin: 'http://localhost:3000',
		optionsSuccessStatus: 204,
	})
);

//parse the cookie through the cookie middleware
app.use(cookieParser());

app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/program', programRouter);
app.use('/api/v1/department', departmentRouter);
app.use('/api/v1/specialty', specialtyRouter);
app.use('/api/v1/student', studentRouter);
app.use('/api/v1/course', courseRouter);
app.use('/api/v1/staff-course', staffCourseRouter);
app.use('/api/v1/mark', markRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/question-category', questionCategoryRouter);
app.use('/api/v1/question', questionRouter);
app.use('/api/v1/review', reviewRouter);
app.use('/api/v1/academic-year', academicYearRouter);
app.use('/api/v1/student-academic-year', studentAcademicYearRouter);
app.use('/api/v1/student-app', studentAppRouter);
app.use('/api/v1/timetable', timetableRouter);
app.use('/api/v1/form-b', formBRouter);
// app.use('/api/v1/sms', smsRouter);

app.all('*', (req, res, next) => {
	const statusCode = 404;
	const message = `${req.originalUrl} not found on this server`;
	next(new ErrorApi(message, statusCode));
});

app.use(errorHandler);

// Notifications Handler
listenToNewMessageAlert();

module.exports = app;
