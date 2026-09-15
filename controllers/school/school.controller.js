const School = require('../../models/school.model');
const ErrorApi = require('../../utilities/ErrorApi');
const catchAsync = require('../../utilities/catchAsync');
const sendResponse = require('../../utilities/sendResponse');
const tenantContext = require('../../utilities/tenantContext');

// The FE-facing counterpart of Stage 9's data migration: every school
// now has a real School document (name, address, contactEmail,
// contactPhone, logo, themeColor), but the frontend was still rendering
// every report/mark-sheet/statistics document with one hardcoded school's
// details baked into the bundle (src/utilities/appData.js's
// schoolHeaderProp) — meaning every tenant's printed documents would
// have shown "Landmark Metropolitan University" regardless of which
// school's staff generated them. This is the endpoint the frontend now
// calls once per session to replace that hardcoded constant with the
// real, authenticated caller's own school.
//
// School isn't tenant-scoped (a school doesn't belong to another
// school — see school.model.js), so this reads schoolId directly from
// the request's tenant context (set by authController.protect) rather
// than relying on tenantScope.plugin.js's auto-injection.
exports.getMySchool = catchAsync(async (req, res, next) => {
	const schoolId = tenantContext.getSchoolId();
	const school = await School.findById(schoolId);

	if (!school) return next(new ErrorApi('School not found', 404));

	sendResponse(res, 'success', 200, school);
});
