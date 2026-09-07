/**
 * The parser, and the real CHANGELOG.md held to the format it parses. parseChangelog skips what it
 * does not recognise, so a mistyped heading would drop a release silently; the shipped changelog is
 * asserted here, where a typo fails the gate instead of the dialog.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { APP_VERSION } from '../../shared/constants.js';
import { parseChangelog, parseInline } from './changelog-parse.js';

const CHANGELOG = readFileSync(
    fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)),
    'utf8',
);

describe('parseChangelog', () => {
    it('reads a release heading and the changes under it', () => {
        const releases = parseChangelog(
            '## 1.2.0 - 2026-09-03\n\n- One thing.\n- Another thing.\n',
        );

        expect(releases).toEqual([
            {
                version: '1.2.0',
                date: '2026-09-03',
                changes: ['One thing.', 'Another thing.'],
                isPatch: false,
            },
        ]);
    });

    it('keeps releases in file order and attributes each change to the heading above it', () => {
        const releases = parseChangelog(
            '## 0.2.0 - 2026-09-10\n- Newer.\n\n## 0.1.0 - 2026-09-03\n- Older.\n',
        );

        expect(releases.map((release) => release.version)).toEqual(['0.2.0', '0.1.0']);
        expect(releases[1].changes).toEqual(['Older.']);
    });

    it('marks a non-zero patch number as a fix, which is what draws the smaller dot', () => {
        const releases = parseChangelog('## 1.0.1 - 2026-09-04\n- Fixed.\n');

        expect(releases[0].isPatch).toBe(true);
    });

    it('accepts a leading v on the version and drops it', () => {
        expect(parseChangelog('## v1.0.0 - 2026-09-03\n')[0].version).toBe('1.0.0');
    });

    // Everything the file may hold for a reader on GitHub and the dialog must not show.
    it('ignores the title, prose, a horizontal rule, and bullets before any heading', () => {
        const releases = parseChangelog(
            '# Changelog\n\nNewest first.\n\n- Stray bullet.\n\n---\n\n## 1.0.0 - 2026-09-03\n- Real.\n',
        );

        expect(releases).toHaveLength(1);
        expect(releases[0].changes).toEqual(['Real.']);
    });

    it('returns nothing for a file with no releases rather than throwing', () => {
        expect(parseChangelog('# Changelog\n')).toEqual([]);
    });
});

describe('parseInline', () => {
    it('returns one run for text with no formatting', () => {
        expect(parseInline('Plain.')).toEqual([{ text: 'Plain.' }]);
    });

    it('returns nothing for an empty change', () => {
        expect(parseInline('')).toEqual([]);
    });

    it.each([
        ['**bold**', 'strong', 'bold'],
        ['*italic*', 'em', 'italic'],
        ['~~gone~~', 's', 'gone'],
        ['<u>under</u>', 'u', 'under'],
        ['`code`', 'code', 'code'],
    ])('reads %s as a %s span', (text, tag, inner) => {
        expect(parseInline(text)).toEqual([{ tag, children: [{ text: inner }] }]);
    });

    it('keeps the text either side of a span', () => {
        expect(parseInline('a **b** c')).toEqual([
            { text: 'a ' },
            { tag: 'strong', children: [{ text: 'b' }] },
            { text: ' c' },
        ]);
    });

    // Two stars beat one, or bold would open as italic and close inside itself.
    it('does not read the opening of a bold run as an italic one', () => {
        expect(parseInline('**b**')).toEqual([{ tag: 'strong', children: [{ text: 'b' }] }]);
    });

    it('nests spans', () => {
        expect(parseInline('**bold *and* both**')).toEqual([
            {
                tag: 'strong',
                children: [
                    { text: 'bold ' },
                    { tag: 'em', children: [{ text: 'and' }] },
                    { text: ' both' },
                ],
            },
        ]);
    });

    // A code span is literal, which is what lets a release note quote the syntax it is about.
    it('leaves delimiters inside a code span as text', () => {
        expect(parseInline('`**not bold**`')).toEqual([
            { tag: 'code', children: [{ text: '**not bold**' }] },
        ]);
    });

    it('reads two spans on one line rather than one span across both', () => {
        expect(parseInline('*one* and *two*')).toEqual([
            { tag: 'em', children: [{ text: 'one' }] },
            { text: ' and ' },
            { tag: 'em', children: [{ text: 'two' }] },
        ]);
    });

    it('leaves an unclosed delimiter as text', () => {
        expect(parseInline('2 * 3 is 6')).toEqual([{ text: '2 * 3 is 6' }]);
    });

    // u is a delimiter, not permission to write HTML: the tags this does not name are text, and
    // nothing here is ever turned into an HTML string.
    it('leaves a tag it does not know as text', () => {
        expect(parseInline('<script>x</script>')).toEqual([{ text: '<script>x</script>' }]);
    });
});

describe('CHANGELOG.md', () => {
    const releases = parseChangelog(CHANGELOG);

    it('parses to at least one release, each with at least one change', () => {
        expect(releases.length).toBeGreaterThan(0);
        for (const release of releases) expect(release.changes.length).toBeGreaterThan(0);
    });

    // The dialog says what this app has been; About says what version it is. They must agree.
    it('leads with the version the app reports', () => {
        expect(releases[0].version).toBe(APP_VERSION);
    });

    it('lists releases newest first', () => {
        const dates = releases.map((release) => release.date);

        expect(dates).toEqual([...dates].sort().reverse());
    });
});
