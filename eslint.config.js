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
 *
 * `scripts/` joined in Phase 4 for a third reason again: it is the only code that *writes content
 * into the repo*. `import-crossword.js` produces the bank files the server then serves, run by hand
 * and rarely, which is exactly the situation where a typo waits months to be discovered. It is pure
 * Node — no browser globals — which is the one way its config differs from the others.
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
        files: ['scripts/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': [
                'error',
                // `const { solution, ...rest } = file` is how a test drops one key to prove the
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
                                'shared/ must import nothing from client/ or server/ — it runs in both (code-style.md §6).',
                        },
                    ],
                },
            ],
        },
    },
];
