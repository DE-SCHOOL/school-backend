const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const ErrorApi = require('./utilities/ErrorApi');
const errorHandler = require('./controllers/error/error.controller');
const resolveCorsOrigin = require('./utilities/corsOrigin');

//ROUTES
const platformRouter = require('./routes/platform/platform.routes');
const personRouter = require('./routes/person/person.routes');
const stellarRouter = require('./routes/stellar/stellar.routes');
const canteenRouter = require('./routes/canteen/canteen.routes');
const staffRouter = require('./routes/staff/staff.routes');
const programRouter = require('./routes/program/program.routes');
const departmentRouter = require('./routes/department/department.routes');
const specialtyRouter = require('./routes/specialty/specialty.routes');
const studentRouter = require('./routes/student/student.routes');
const courseRouter = require('./routes/course/course.routes');
const staffCourseRouter = require('./routes/staff-course/staff_course.routes');
const markRouter = require('./routes/mark/mark.routes');
const attendanceRouter = require('./routes/attendance/attendance.routes');
const questionCategoryRouter = require('./routes/question/question_category.routes');
const questionRouter = require('./routes/question/question.routes');
const reviewRouter = require('./routes/review/review.routes');
const academicYearRouter = require('./routes/academic-year/academic_year.routes');
const studentAcademicYearRouter = require('./routes/academic-year/student_academic_year.routes');
const studentAppRouter = require('./routes/mobile/mobile.student.routes');
// const smsRouter = require('./routes/sms routes/sms.routes');
const timetableRouter = require('./routes/timetable/timetable.routes');
const formBRouter = require('./routes/form-b/formb.routes');
const schoolRouter = require('./routes/school/school.routes');
const listenToNewMessageAlert = require('./controllers/notification/notification');
const app = express();

//parse the body object to express
app.use(express.json());

//handle Access control origin
// Was a single hardcoded origin (one school's URL) — now resolved
// per-request against every registered school's allowedOrigins, since
// this is a multi-tenant platform now. See utilities/corsOrigin.js.
app.use(
	cors({
		credentials: true,
		methods: 'POST,GET,PATCH,DELETE',
		origin: resolveCorsOrigin,
		optionsSuccessStatus: 204,
	})
);

//parse the cookie through the cookie middleware
app.use(cookieParser());

const limiter = rateLimit({
	windowMs: process.env.RATE_LIMIT_WAIT_TIME || 3 * 60 * 1000, //For 3 minutes
	limit: process.env.RATE_LIMIT_ATTEMPTS || 10,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: 'Too many request, try again in 3 minutes.',
	statusCode: 429,
});

app.use('/api/v1/staff', limiter);
app.use('/api/v1/platform', limiter);
app.use('/api/v1/person', limiter);
app.use('/api/v1/stellar', limiter);
app.use('/api/v1/canteen', limiter);

app.use('/api/v1/platform', platformRouter);
app.use('/api/v1/person', personRouter);
app.use('/api/v1/stellar', stellarRouter);
app.use('/api/v1/canteen', canteenRouter);
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
app.use('/api/v1/school', schoolRouter);
// app.use('/api/v1/sms', smsRouter);

// Express 5's router (path-to-regexp v8) no longer accepts a bare '*'
// wildcard path. A path-less app.use() as the final handler achieves the
// same "catch anything not matched above" behavior without depending on
// wildcard path syntax at all.
app.use((req, res, next) => {
	const statusCode = 404;
	const message = `${req.originalUrl} not found on this server`;
	next(new ErrorApi(message, statusCode));
});

app.use(errorHandler);

module.exports = app;
module.exports.listenToNewMessageAlert = listenToNewMessageAlert;
