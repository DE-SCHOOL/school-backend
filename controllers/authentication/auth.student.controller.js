const { db, auth } = require('./../../firebase.config');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');
const sendResponse = require('./../../utilities/sendResponse');
const Student = require('./../../models/students.model');
const { createToken, verifyToken } = require('../../utilities/jwt');

exports.signUp = catchAsync(async (req, res, next) => {
	const { id, password, confirmPassword } = req.body;

	if (!id || !password || !confirmPassword) {
		return next(new ErrorApi('All fields are required', 400));
	}

	if (password !== confirmPassword) {
		return next(new ErrorApi('Passwords do not match', 400));
	}

	const student = await Student.findById(id);

	if (!student) {
		return next(new ErrorApi('Student not found with this ID', 404));
	}

	const token = await createToken(id, process.env.JWT_SECRET_STUDENT);

	//Update student password
	student.password = password;
	await student.save();

	//Add student to firestore db
	await db
		.collection('users')
		.doc(id)
		.set({
			name: student._doc.name,
			email: student._doc.email,
			gender: student._doc.gender,
			picture: student._doc.picture || 'n/a',
		});

	//Create custom auth token and add to request
	const customToken = await auth.createCustomToken(id, { role: 'student' });

	student._doc.token = token;
	student._doc.customToken = customToken;

	sendResponse(res, 'success', 200, student);
});

exports.login = catchAsync(async (req, res, next) => {
	const { id, password } = req.body;

	if (!id || !password) {
		return next(new ErrorApi('All fields are required', 400));
	}

	const student = await Student.findById(id).select('+password');

	if (!student) {
		return next(new ErrorApi('Student not found with this ID', 404));
	}

	// console.log(password, student.password, 'JEFF');
	if (!student?.password) {
		return next(
			new ErrorApi(
				'Password for this accound not yet set. Please sign in instead!',
				400
			)
		);
	}

	const isMatch = await student.isPasswordCorrect(password, student.password);

	if (!isMatch) {
		return next(new ErrorApi('Incorrect Password', 401));
	}

	student._doc.password = undefined;

	const token = await createToken(student._id, process.env.JWT_SECRET_STUDENT);

	//Add student to firestore db
	await db
		.collection('users')
		.doc(id)
		.set({
			name: student._doc.name,
			email: student._doc.email,
			gender: student._doc.gender,
			picture: student._doc.picture || 'n/a',
		});

	//Create custom auth token and add to request
	const customToken = await auth.createCustomToken(id, { role: 'student' });

	student._doc.token = token;
	student._doc.customToken = customToken;

	sendResponse(res, 'success', 200, student);
});

//654b7a372caa36e3cb28c5fa emily.wilson@example.com
//123456asd987asd456321df4

exports.protect = catchAsync(async (req, res, next) => {
	const token = req.params.tokenID;
	if (!token) {
		return next(new ErrorApi('You are not logged in', 401));
	}
	const decoded = await verifyToken(token, process.env.JWT_SECRET_STUDENT);

	const userInfo = { ...decoded };

	const user = await Student.findById(`${userInfo.id}`);

	if (!user) return next(new ErrorApi('User Does No Longer Exist', 403));

	req.student = user;

	next();
});
