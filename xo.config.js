import xoReact from 'eslint-config-xo-react';

const xoConfig = [
	{ignores: ['dist', 'site/**', 'package.json', '**/*.md']},
	...xoReact({prettier: true}),
	{
		prettier: true,
		space: false,
		rules: {
			// PascalCase component files (.tsx) and kebab-case modules (.ts) coexist.
			'unicorn/filename-case': [
				'error',
				{cases: {kebabCase: true, pascalCase: true}},
			],
		},
	},
	{
		// Tests run on ava, whose own `ava/no-import-test-files` uses the real test
		// glob. The node:test rule treats anything under `test/` (incl. helpers) as a test.
		files: ['test/**'],
		languageOptions: {
			parserOptions: {projectService: false, project: './tsconfig.test.json'},
		},
		rules: {
			'node-test/no-import-test-files': 'off',
		},
	},
];

export default xoConfig;
