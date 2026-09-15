const mongoose = require('mongoose');
const tenantContext = require('./tenantContext');

// Mongoose plugin applied to every school-owned schema (students, staff,
// courses, marks, ...) — NOT applied to `school` or `platform_staff`,
// which are platform-level and have no owning school.
//
// Design: fail CLOSED, not open. Every query/save/aggregate on a
// tenant-scoped model requires an active tenant context (set by
// authController.protect / auth.student.controller's protect right after
// resolving who's making the request) or it throws, rather than silently
// running unscoped. The few legitimate call sites that must run before a
// tenant is known — login lookups, protect's own user-by-id lookup —
// opt out explicitly and deliberately with `.setOptions({ skipTenantScope: true })`
// (queries) or `doc.$locals.skipTenantScope = true` (document saves), so
// every exception is a visible, greppable line, not an accidental gap.
//
// This is deliberately stricter than the original Stage 3 plan (which
// only auto-injected scoping when a context happened to exist) — a
// missing context should be a loud bug during development, not a silent
// cross-tenant data leak in production.
//
// All hooks below are promise-style (no `next` param, throw to fail) —
// NOT the `function (next) { ...; next(); }` style used throughout the
// rest of this codebase's pre-hooks. That style is broken under the
// Mongoose 9 this project runs now: document AND query middleware are
// invoked without a usable `next` callback, so calling next() throws
// "next is not a function" and the hook body silently never completes.
// See the same fix applied to every model file for the full story.

// Query-only middleware names — unambiguous, no document-level equivalent.
const QUERY_ONLY_HOOKS = [
	'find',
	'findOne',
	'findOneAndUpdate',
	'findOneAndDelete',
	'findOneAndReplace',
	'countDocuments',
	'updateMany',
	'deleteMany',
];

// 'updateOne' and 'deleteOne' exist as BOTH document middleware
// (doc.deleteOne()) and query middleware (Model.deleteOne(filter)) in
// Mongoose — registered without { query: true, document: false } they'd
// also fire on document instances, which have no .getOptions().
const AMBIGUOUS_QUERY_HOOKS = ['updateOne', 'deleteOne'];

class TenantScopeError extends Error {
	constructor(message) {
		super(message);
		this.name = 'TenantScopeError';
		this.statusCode = 500;
	}
}

function tenantScopePlugin(schema) {
	schema.add({
		schoolId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'school',
			required: [true, 'schoolId is required on every tenant-owned document'],
			index: true,
		},
	});

	function scopeQuery() {
		if (this.getOptions().skipTenantScope) {
			return;
		}

		const schoolId = tenantContext.getSchoolId();

		if (!schoolId) {
			throw new TenantScopeError(
				`${this.model.modelName}.${this.op}() ran with no active tenant context and no explicit skipTenantScope option. ` +
					'If this call is genuinely meant to run before a tenant is known (e.g. login), add .setOptions({ skipTenantScope: true }) explicitly.'
			);
		}

		this.where({ schoolId });
	}

	schema.pre(QUERY_ONLY_HOOKS, scopeQuery);
	schema.pre(AMBIGUOUS_QUERY_HOOKS, { query: true, document: false }, scopeQuery);

	schema.pre('validate', function () {
		if (this.$locals.skipTenantScope) {
			return;
		}

		if (!this.isNew) {
			// Existing document: schoolId was already required and assigned
			// when it was first created, so it's always present by now — the
			// only thing left to check is that nothing re-parented it. (This
			// has to run BEFORE the "already has a schoolId" shortcut below,
			// since an existing doc's schoolId is *always* truthy — checking
			// truthiness first would skip this guard entirely.)
			if (this.isModified('schoolId')) {
				throw new TenantScopeError(
					`Refusing to silently change ${this.constructor.modelName}'s schoolId on an existing document. ` +
						'Set doc.$locals.skipTenantScope = true if this is a deliberate, reviewed data migration.'
				);
			}
			return;
		}

		if (this.schoolId) {
			// New document with an explicit schoolId already provided (e.g.
			// the platform-only "create a school's first admin" flow) —
			// nothing to infer.
			return;
		}

		const schoolId = tenantContext.getSchoolId();

		if (!schoolId) {
			throw new TenantScopeError(
				`${this.constructor.modelName} document has no schoolId and no active tenant context to infer it from. ` +
					'Either set schoolId explicitly before saving, or set doc.$locals.skipTenantScope = true if this is genuinely a platform-level operation.'
			);
		}

		this.schoolId = schoolId;
	});

	schema.pre('aggregate', function () {
		if (this.options.skipTenantScope) {
			return;
		}

		const schoolId = tenantContext.getSchoolId();

		if (!schoolId) {
			throw new TenantScopeError(
				`${this._model?.modelName || 'Model'}.aggregate() ran with no active tenant context and no explicit skipTenantScope option. ` +
					'Add .option({ skipTenantScope: true }) explicitly if this is genuinely a platform-level aggregation.'
			);
		}

		this.pipeline().unshift({ $match: { schoolId } });
	});
}

module.exports = tenantScopePlugin;
module.exports.TenantScopeError = TenantScopeError;
