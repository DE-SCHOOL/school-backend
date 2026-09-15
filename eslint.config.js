const js = require('@eslint/js');
const globals = require('globals');

// Deliberately scoped to catching real bugs (unused variables,
// undefined references, unreachable code), not enforcing a style —
// style disagreements aren't worth blocking a PR over on a project this
// size with no prior lint history; correctness issues are.
module.exports = [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: {
				...globals.node,
				...globals.jest,
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
	{
		ignores: ['node_modules/', 'contracts/target/', 'contracts/**/*.rs'],
	},
];
