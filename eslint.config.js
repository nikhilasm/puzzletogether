import js from '@eslint/js';
import globals from 'globals';

/*
 * Scoped deliberately to `shared/` — the socket contract.
 *
 * `shared/protocol.js`, `shared/schema.js`, and `shared/board-reducer.js` are the code both sides
 * of the wire depend on, and the only place a silent mismatch causes a desync rather than a visible
 * bug. Application code in `client/` and `server/` is not linted; formatting there is Prettier's
 * job and correctness is the tests'.
 */
export default [
    {
        ignores: ['client/**', 'server/**', 'node_modules/**', '*.config.js'],
    },
    js.configs.recommended,
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
