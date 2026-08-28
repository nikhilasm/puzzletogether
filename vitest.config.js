import { defineConfig } from 'vitest/config';

// Tests sit beside the module they cover (<module>.test.js, per code-style.md §5). Everything in
// Phase 1 runs in Node; component tests add // @vitest-environment jsdom per file when they land.
export default defineConfig({
    test: {
        environment: 'node',
        // scripts/ joins the list in Phase 4: the crossword importer is the first thing in there
        // with logic worth testing, and its refusals are the whole point of it (design-spec.md §8).
        include: ['{shared,server,client,scripts}/**/*.test.js'],
    },
});
