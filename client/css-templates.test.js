/**
 * A backtick inside a CSS comment ends the css template literal. This has broken the build eight times
 * and once did not (the remainder parsed as valid JavaScript, so the build passed and every browser
 * test failed pointing nowhere near the CSS), which is the case this test exists for (code-style.md §9).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/**
 * Every module under client/ that could hold a css template. Walked by hand rather than globbed, so a
 * guard against a build-breaking typo adds no dependency of its own; dist/ and test files are skipped.
 */
function sourceFiles(dir = ROOT) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'dist' || entry.name === 'node_modules') continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...sourceFiles(path));
        else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) found.push(path);
    }
    return found;
}

/**
 * Walks one css template from just after its opening backtick and reports how it ends. Interpolations
 * are skipped whole, since a backtick inside one is a nested template rather than a terminator, and the
 * two CSS comment forms and the string quotes are tracked so a comment-opening sequence in a string is
 * not mistaken for one.
 *
 * @returns {{index: number, inComment: boolean}} Where the template ended, and whether that
 *   backtick was sitting inside a comment when it did.
 */
function findTemplateEnd(source, start) {
    let inBlockComment = false;
    let quote = null;

    for (let i = start; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];

        if (char === '\\') {
            i += 1;
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && next === '/') {
                inBlockComment = false;
                i += 1;
            } else if (char === '`') {
                return { index: i, inComment: true };
            }
            continue;
        }

        if (quote) {
            if (char === quote) quote = null;
            continue;
        }

        if (char === '/' && next === '*') {
            inBlockComment = true;
            i += 1;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        // An interpolation holds JavaScript, not CSS. Skip it whole, matching braces.
        if (char === '$' && next === '{') {
            let depth = 1;
            i += 2;
            while (i < source.length && depth > 0) {
                if (source[i] === '{') depth += 1;
                if (source[i] === '}') depth -= 1;
                i += 1;
            }
            i -= 1;
            continue;
        }
        if (char === '`') return { index: i, inComment: false };
    }

    return { index: -1, inComment: false };
}

/** Every offending comment backtick in one file, as line: text for the failure message. */
function offencesIn(source) {
    const offences = [];
    // The lookbehind is load-bearing: without it, prose mentioning tokens.css in a JSDoc reads as
    // a tagged template opening, and the scan walks off into a file that has no CSS in it at all.
    const opener = /(?<![\w.$])css`/g;
    let match;

    while ((match = opener.exec(source)) !== null) {
        const end = findTemplateEnd(source, match.index + match[0].length);
        if (end.index === -1 || !end.inComment) {
            if (end.index !== -1) opener.lastIndex = end.index + 1;
            continue;
        }

        const line = source.slice(0, end.index).split('\n').length;
        const text = source.split('\n')[line - 1].trim();
        offences.push(`line ${line}: ${text}`);
        opener.lastIndex = end.index + 1;
    }

    return offences;
}

describe('css templates', () => {
    const files = sourceFiles();

    it('finds the client modules to scan', () => {
        expect(files.length).toBeGreaterThan(10);
    });

    it.each(files.map((file) => relative(ROOT, file)))(
        '%s closes every css template outside a comment',
        (name) => {
            const offences = offencesIn(readFileSync(join(ROOT, name), 'utf8'));
            expect(
                offences,
                `a backtick inside a CSS comment ends the template early:\n  ${offences.join('\n  ')}`,
            ).toEqual([]);
        },
    );
});
