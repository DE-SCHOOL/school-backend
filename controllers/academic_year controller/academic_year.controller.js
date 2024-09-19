const AcademicYear = require('./../../models/academic_year.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const sendResponse = require('./../../utilities/sendResponse');
const catchAsync = require('./../../utilities/catchAsync');

exports.createAcademicYear = catchAsync(async (req, res, next) => {
	const year = req.body.academicYear;

	if (!year) return ErrorApi('Enter the Academic Year', 400);

	const academicYear = await AcademicYear.create({ schoolYear: year });
	sendResponse(res, 'success', 201, academicYear);
});

exports.getAcademicYears = catchAsync(async (req, res, next) => {
	const data = await AcademicYear.find({});
	sendResponse(res, 'success', 200, data);
});

exports.updateAcademicYears = catchAsync(async (req, res, next) => {
	const id = req.params.id;
	const data = await AcademicYear.updateMany(
		{ isCurrent: true },
		{ isCurrent: false },
		{ new: true }
	);

	const newUpdate = await AcademicYear.findByIdAndUpdate(id, {
		isCurrent: true,
	});

	sendResponse(res, 'success', 200, newUpdate);
});

exports.getCurrentYear = catchAsync(async (req, res, next) => {
	const currentYear = await AcademicYear.findOne({ isCurrent: true });
	sendResponse(res, 'success', 200, currentYear);
});
