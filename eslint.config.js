import js from '@eslint/js';
import globals from 'globals';

/*
 * Scoped deliberately to `shared/` — the socket contract.
 *
 * `shared/protocol.js`, `shared/schema.js`, and `shared/board-reducer.js` are the code both sides
 * of the wire depend on, and the only place a silent mismatch causes a desync rather than a visible
 * bug. Application code in `client/` and `server/` is not linted; formatting there is Prettier's
 * job and correctness is the tests'.
 *
 * `tests/` is the exception to that reasoning rather than a widening of it: it is the only code in
 * the repo nothing else checks. Everything else has a test; the tests have lint.
 */
export default [
    {
        ignores: ['client/**', 'server/**', 'node_modules/**', '*.config.js'],
    },
    js.configs.recommended,
    {
        // Browser globals appear inside `page.evaluate()` callbacks, which run in the page.
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
                                'shared/ must import nothing from client/ or server/ — it runs in both (code-style.md §6).',
                        },
                    ],
                },
            ],
        },
    },
];
