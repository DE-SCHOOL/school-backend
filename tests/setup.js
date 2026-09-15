// Loaded via jest.config.js `setupFiles` before any test file runs.
// Provides the env vars app.js's require graph needs just to boot
// (JWT secret, cookie expiry) without depending on a real database.
// firebase.config.js is mocked out entirely for tests (see
// jest.config.js's moduleNameMapper), so no Firebase credentials are
// needed here.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.COOKIE_EXP = process.env.COOKIE_EXP || '1';
