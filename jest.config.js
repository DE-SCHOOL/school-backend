module.exports = {
	testEnvironment: 'node',
	setupFiles: ['./tests/setup.js'],
	testMatch: ['**/tests/**/*.test.js'],
	moduleNameMapper: {
		'firebase\\.config$': '<rootDir>/tests/__mocks__/firebase.config.js',
		'^@stellar/stellar-sdk$': '<rootDir>/tests/__mocks__/stellar-sdk.js',
	},
};
