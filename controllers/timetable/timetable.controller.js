const sendResponse = require('./../../utilities/sendResponse');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');
const Timetable = require('./../../models/timetable.model');

exports.createTimetable = catchAsync(async (req, res, next) => {
	const { name, level, specialty, academicYear, semester, downloadUrl } =
		req.body;

	const timetable = await Timetable.create({
		name,
		level,
		specialty,
		academicYear,
		semester,
		downloadUrl,
	});

	sendResponse(res, 'success', 201, timetable);
});

exports.getAllTimetables = catchAsync(async (req, res, next) => {
	const timetables = await Timetable.find({}).sort({ level: -1, semester: 1 });

	sendResponse(res, 'success', 200, timetables);
});

exports.deleteTimetable = catchAsync(async (req, res, next) => {
	const { id } = req.params;

	const timetables = await Timetable.deleteOne({ _id: id });

	sendResponse(res, 'success', 200, timetables);
});
