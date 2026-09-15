const Person = require('../../models/person.model');
const Student = require('../../models/students.model');
const School = require('../../models/school.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');
const { createToken, verifyToken } = require('../../utilities/jwt');

exports.signup = catchAsync(async (req, res, next) => {
	const { name, email, phone, password, confirmPassword } = req.body;

	if (!name || !email || !password || !confirmPassword) {
		return next(new ErrorApi('All fields are required', 400));
	}
	if (password !== confirmPassword) {
		return next(new ErrorApi('Passwords do not match', 400));
	}

	const person = await Person.create({ name, email, phone, password });
	person._doc.password = undefined;

	const token = await createToken(`${person._id}`, process.env.JWT_SECRET_PERSON);
	person._doc.token = token;

	sendResponse(res, 'success', 201, person);
});

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;

	if (!email || !password) {
		return next(new ErrorApi('Email or password missing', 400));
	}

	const person = await Person.findOne({ email }).select('+password');

	if (!person) return next(new ErrorApi('User not found with this email', 403));

	const isCorrect = await person.isPasswordCorrect(password);
	if (!isCorrect) {
		return next(new ErrorApi('Incorrect password, please try again', 401));
	}

	const token = await createToken(`${person._id}`, process.env.JWT_SECRET_PERSON);

	person._doc.password = undefined;
	person._doc.token = token;

	sendResponse(res, 'success', 200, person);
});

exports.protect = catchAsync(async (req, res, next) => {
	const token = req.params.tokenID;
	if (!token) {
		return next(new ErrorApi('No token, please login to be an authorized user', 401));
	}

	const decoded = await verifyToken(token, process.env.JWT_SECRET_PERSON);
	const person = await Person.findById(decoded.id);

	if (!person) {
		return next(new ErrorApi('Something went wrong. Please login to continue', 403));
	}

	req.person = person;
	next();
});

// Claims an existing, staff-created Student enrollment for this Person.
// Identity check is matricule + school slug + date of birth — every
// Student record already has all three (dob is required on creation),
// so this needs no new data collected from the school's side, and no
// email/phone had to already be on file for the student either (per
// students.model.js, both are optional there).
exports.linkEnrollment = catchAsync(async (req, res, next) => {
	const { schoolSlug, matricule, dob } = req.body;

	if (!schoolSlug || !matricule || !dob) {
		return next(new ErrorApi('schoolSlug, matricule, and dob are required', 400));
	}

	const school = await School.findOne({ slug: schoolSlug });
	if (!school) return next(new ErrorApi('No school found with that slug', 404));

	// No active tenant context exists for this request (a Person isn't
	// scoped to any one school) — this is exactly the cross-tenant "a
	// student's own data" exception my-todo.md Stage 5 flagged, not a
	// gap in the scoping rules.
	const student = await Student.findOne({
		schoolId: school._id,
		matricule,
	}).setOptions({ skipTenantScope: true });

	if (!student) {
		return next(new ErrorApi('No matching student record found', 404));
	}

	const providedDob = new Date(dob).toISOString().slice(0, 10);
	const actualDob = new Date(student.dob).toISOString().slice(0, 10);
	if (providedDob !== actualDob) {
		return next(new ErrorApi('No matching student record found', 404));
	}

	if (student.personId && String(student.personId) !== String(req.person._id)) {
		return next(
			new ErrorApi('This student record is already linked to a different account', 409)
		);
	}

	student.personId = req.person._id;
	await student.save({ validateModifiedOnly: true });

	sendResponse(res, 'success', 200, student);
});

exports.listEnrollments = catchAsync(async (req, res, next) => {
	// Cross-school by design — see linkEnrollment's identical note.
	const enrollments = await Student.find({ personId: req.person._id })
		.setOptions({ skipTenantScope: true })
		.populate('schoolId', 'name slug logo');

	sendResponse(res, 'success', 200, enrollments);
});

// Mints an ordinary per-student JWT — identical in shape and secret
// (JWT_SECRET_STUDENT) to what auth.student.controller.js's own login
// issues — for whichever linked enrollment the Person picks. This is
// the whole reason Stage 5 didn't need to touch a single existing
// student-scoped route: from here on, the frontend just uses this token
// exactly like a normal student login, against the entire existing API
// surface (routes/mobile/mobile.student.routes.js included) unmodified.
exports.switchEnrollment = catchAsync(async (req, res, next) => {
	const student = await Student.findById(req.params.studentId).setOptions({
		skipTenantScope: true,
	});

	if (!student) return next(new ErrorApi('Student not found', 404));

	if (!student.personId || String(student.personId) !== String(req.person._id)) {
		return next(new ErrorApi('This enrollment is not linked to your account', 403));
	}

	const token = await createToken(`${student._id}`, process.env.JWT_SECRET_STUDENT);

	sendResponse(res, 'success', 200, { token, student });
});
