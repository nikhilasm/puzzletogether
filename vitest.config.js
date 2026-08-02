import { defineConfig } from 'vitest/config';

// Tests sit beside the module they cover (`<module>.test.js`, per code-style.md §5). Everything in
// Phase 1 runs in Node; component tests add `// @vitest-environment jsdom` per file when they land.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['{shared,server,client}/**/*.test.js'],
    },
});
