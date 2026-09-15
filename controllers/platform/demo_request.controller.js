const DemoRequest = require('../../models/demo_request.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');

// Public — no auth at all, deliberately. This is the top-of-funnel form
// a prospective school fills in before they have any account with the
// platform whatsoever.
exports.createDemoRequest = catchAsync(async (req, res, next) => {
	const {
		name,
		schoolName,
		contactEmail,
		contactPhone,
		cityRegion,
		studentCount,
		notes,
	} = req.body;

	const demoRequest = await DemoRequest.create({
		name,
		schoolName,
		contactEmail,
		contactPhone,
		cityRegion,
		studentCount,
		notes,
	});

	sendResponse(res, 'success', 201, demoRequest);
});

// Everything below is platform-super-admin-only — the actual sales
// pipeline (see my-todo.md Stage 4's status-state note).
exports.getAllDemoRequests = catchAsync(async (req, res, next) => {
	const demoRequests = await DemoRequest.find({}).sort({ createdAt: -1 });
	sendResponse(res, 'success', 200, demoRequests);
});

exports.setDemoRequestStatus = catchAsync(async (req, res, next) => {
	const { status } = req.body;
	const validStatuses = [
		'lead',
		'demo_scheduled',
		'contract_sent',
		'active',
		'suspended',
		'churned',
	];

	if (!validStatuses.includes(status)) {
		return next(new ErrorApi('Invalid status', 400));
	}

	const demoRequest = await DemoRequest.findByIdAndUpdate(
		req.params.id,
		{ status },
		{ new: true, runValidators: true }
	);

	if (!demoRequest) return next(new ErrorApi('Demo request not found', 404));

	sendResponse(res, 'success', 200, demoRequest);
});
