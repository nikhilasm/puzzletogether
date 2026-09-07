import js from '@eslint/js';
import globals from 'globals';

/*
 * Lint is scoped to shared/ (the socket contract, where a silent mismatch desyncs rather than shows a
 * bug), plus tests/ (the only code nothing else checks) and scripts/ (the only code that writes bank
 * files into the repo). Application code in client/ and server/ is left to Prettier and the tests.
 */
export default [
    {
        ignores: ['client/**', 'server/**', 'node_modules/**', '*.config.js'],
    },
    js.configs.recommended,
    {
        // Browser globals appear inside page.evaluate() callbacks, which run in the page.
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'prefer-const': 'error',
        },
    },
    {
        files: ['scripts/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': [
                'error',
                // const { solution, ...rest } = file is how a test drops one key to prove the
                // reader refuses what is left. The binding is unused by design.
                { argsIgnorePattern: '^_', ignoreRestSiblings: true },
            ],
            'prefer-const': 'error',
        },
    },
    {
        files: ['shared/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-implicit-coercion': 'error',
            // shared/ runs in both environments, so it may import from neither side.
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/client/**', '**/server/**', '../client/*', '../server/*'],
                            message:
                                'shared/ must import nothing from client/ or server/; it runs in both (code-style.md §6).',
                        },
                    ],
                },
            ],
        },
    },
];
