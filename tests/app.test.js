const request = require('supertest');
const app = require('../app');

// These tests deliberately only exercise routing/middleware behavior that
// doesn't require a live MongoDB connection (nothing here hits a
// Mongoose model). DB-backed controller/integration tests are tracked as
// a follow-up once a test-database strategy exists — see my-todo.md
// Stage 2/10.

describe('unmatched routes', () => {
	it('returns a 404 with the standard error shape for a route that does not exist', async () => {
		const res = await request(app).get('/api/v1/this-route-does-not-exist');

		expect(res.status).toBe(404);
		expect(res.body).toHaveProperty('status', 'Failed');
		expect(res.body.message).toMatch(/not found on this server/i);
	});
});

describe('CORS', () => {
	it('reflects credentials/allowed-methods headers for the configured origin', async () => {
		const res = await request(app)
			.options('/api/v1/staff')
			.set('Origin', 'https://gttcbuea.onrender.com')
			.set('Access-Control-Request-Method', 'GET');

		expect(res.headers['access-control-allow-origin']).toBe(
			'https://gttcbuea.onrender.com'
		);
		expect(res.headers['access-control-allow-credentials']).toBe('true');
	});
});

describe('rate limiting on /api/v1/staff', () => {
	it('starts returning 429 once the configured request limit is exceeded', async () => {
		const limit = Number(process.env.RATE_LIMIT_ATTEMPTS) || 10;

		let lastStatus;
		for (let i = 0; i < limit + 1; i++) {
			// eslint-disable-next-line no-await-in-loop
			const res = await request(app).get('/api/v1/staff');
			lastStatus = res.status;
		}

		expect(lastStatus).toBe(429);
	});
});
