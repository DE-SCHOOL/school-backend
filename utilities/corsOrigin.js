const School = require('../models/school.model');

// One known origin from before this app went multi-tenant, kept as a
// safety net through the Stage 9 data-migration cutover so the one real
// live school never gets locked out because its School.allowedOrigins
// hasn't been backfilled yet. LEGACY_ALLOWED_ORIGINS is a comma-separated
// env var; falls back to the single origin app.js used to hardcode if
// that env var isn't set, so nothing changes for the existing deployment
// until someone deliberately configures it otherwise.
const legacyOrigins = (
	process.env.LEGACY_ALLOWED_ORIGINS || 'https://gttcbuea.onrender.com'
)
	.split(',')
	.map((o) => o.trim())
	.filter(Boolean);

// cors' `origin` option, given as a function: (origin, callback) => void.
// `origin` is undefined for requests with no Origin header at all (the
// mobile app, curl, server-to-server) — CORS is a browser-enforced
// mechanism, so there's nothing to restrict for a non-browser caller;
// only same-origin/cross-origin browser requests actually consult the
// Access-Control-Allow-Origin header this produces.
module.exports = async function resolveCorsOrigin(origin, callback) {
	if (!origin) {
		return callback(null, true);
	}

	if (legacyOrigins.includes(origin)) {
		return callback(null, true);
	}

	try {
		const school = await School.findOne({ allowedOrigins: origin });
		callback(null, Boolean(school));
	} catch (err) {
		callback(err, false);
	}
};
