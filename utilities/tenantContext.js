const { AsyncLocalStorage } = require('async_hooks');

// Carries { schoolId } (or null for platform-level staff acting with no
// school scope) through the async call chain of a single request, so the
// tenant-scoping plugin (utilities/tenantScope.plugin.js) can read it
// without every controller having to pass schoolId around explicitly.
// Set once, in authController.protect / auth.student.controller's
// protect, right after the requesting user is resolved from the DB —
// never from a client-supplied value.
const storage = new AsyncLocalStorage();

exports.run = (context, fn) => storage.run(context, fn);

exports.getContext = () => storage.getStore();

exports.getSchoolId = () => storage.getStore()?.schoolId ?? null;
