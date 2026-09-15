exports.TO_ALL = [
	'student',
	'lecturer',
	'secreteriat',
	'hod',
	'director',
	'admin',
];

exports.TO_ALL_STAFF = ['lecturer', 'secreteriat', 'hod', 'director', 'admin'];
exports.TO_ALL_OFFICE_STAFF = ['secreteriat', 'hod', 'director', 'admin'];
exports.TO_ALL_OFFICE_ADMIN = ['hod', 'director', 'admin'];
exports.TO_MAIN_ADMIN = ['director', 'admin'];

// Platform-level roles (models/platform_staff.model.js) — people who run
// DE-SCHOOL itself, distinct from any school's own staff roles above. A
// school's 'admin' role only ever means "runs this one school"; it never
// implies platform access, and vice versa — these two role sets are
// checked by entirely separate middleware (authController.restrictTo vs.
// platformAuthController.restrictToPlatform) against entirely separate
// collections (staff vs. platform_staff), never mixed.
exports.TO_PLATFORM_SUPER_ADMIN = ['super_admin'];
exports.TO_ALL_PLATFORM_STAFF = ['super_admin', 'operations'];
