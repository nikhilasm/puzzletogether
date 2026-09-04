/**
 * Reads CHANGELOG.md into the releases <pt-changelog> draws.
 *
 * The file is the changelog and this is the only thing that interprets it, so the format it accepts
 * is deliberately small: enough to render, and not a Markdown implementation. A heading opens a
 * release, a hyphen bullet is one change in the release above it, and every other line is ignored,
 * which is what lets the file carry a title and a note about itself without either reaching the
 * dialog.
 *
 *     ## 1.2.0 - 2026-09-03
 *
 *     - One change, one sentence, with **bold** or `code` where it earns it.
 *
 * A change carries five inline spans and no others: bold, italic, code, strikethrough, and
 * underline. They are never turned into an HTML string. parseInline returns spans and the dialog
 * builds elements from them, so the only markup in the page is markup this file names, and a
 * stray angle bracket in a release note is a stray angle bracket on the screen.
 */

/** A release heading: two hashes, a semver version, a hyphen, an ISO date. A leading v is allowed. */
const HEADING = /^##\s+v?(\d+)\.(\d+)\.(\d+)\s+-\s+(\d{4}-\d{2}-\d{2})$/;

/** One change: a hyphen, a space, and the text. The space is what keeps a --- rule out. */
const CHANGE = /^-\s+(\S.*)$/;

/**
 * The inline spans a change may carry, in the order they are tried.
 *
 * Code comes first because a code span is literal: an asterisk inside one is an asterisk, which is
 * what Markdown does and what makes the syntax quotable in a release note about it. Two stars beat
 * one, or every bold run would open as an italic one and close in the middle of itself.
 *
 * Underline is the odd entry. Markdown has no syntax for it, and __text__ is bold everywhere else,
 * so taking that would make the file render one way on GitHub and another here. GitHub passes a u
 * element through, so the tag is the syntax. It is a delimiter to this parser and not permission
 * to write HTML: every other tag in a change is text.
 */
const INLINE = [
    { tag: 'code', pattern: /`([^`]+)`/, literal: true },
    { tag: 'strong', pattern: /\*\*(.+?)\*\*/ },
    { tag: 's', pattern: /~~(.+?)~~/ },
    { tag: 'u', pattern: /<u>(.+?)<\/u>/ },
    { tag: 'em', pattern: /\*(.+?)\*/ },
];

/**
 * @typedef {{ text: string } | { tag: string, children: InlineNode[] }} InlineNode
 */

/**
 * @typedef {object} Release
 * @property {string} version - Semver, without a leading v.
 * @property {string} date - ISO date the version shipped.
 * @property {string[]} changes - One line each, in the order the file lists them.
 * @property {boolean} isPatch - True when the patch number is not 0: a fix rather than a release.
 */

/**
 * Parses changelog text into releases, in the order the file lists them.
 *
 * Never throws and never rejects a file: an unrecognised line is skipped, since a malformed heading
 * should cost one entry rather than blank the dialog in front of a player. What holds the real file
 * to the format is changelog-parse.test.js, which runs before anybody ships it.
 *
 * @param {string} text - The contents of CHANGELOG.md.
 * @returns {Release[]} One entry per heading that parsed, newest first if the file is.
 */
export function parseChangelog(text) {
    const releases = [];

    for (const line of text.split('\n')) {
        const trimmed = line.trim();

        const heading = HEADING.exec(trimmed);
        if (heading) {
            const [, major, minor, patch, date] = heading;
            releases.push({
                version: `${major}.${minor}.${patch}`,
                date,
                changes: [],
                isPatch: patch !== '0',
            });
            continue;
        }

        const change = CHANGE.exec(trimmed);
        if (change && releases.length > 0) releases.at(-1).changes.push(change[1]);
    }

    return releases;
}

/**
 * Splits one change into the spans the dialog draws, recursing so spans can nest.
 *
 * The leftmost delimiter wins, and a tie goes to whichever rule INLINE lists first. An unclosed
 * delimiter is text: the alternative is a release note that swallows the rest of its own line
 * because somebody wrote an asterisk.
 *
 * @param {string} text - One change, as it appears in the file.
 * @returns {InlineNode[]} Text runs and spans, in reading order. Empty for empty input.
 */
export function parseInline(text) {
    let found = null;
    for (const rule of INLINE) {
        const match = rule.pattern.exec(text);
        if (match && (found === null || match.index < found.match.index)) found = { rule, match };
    }

    if (!found) return text ? [{ text }] : [];

    const { rule, match } = found;
    const before = text.slice(0, match.index);
    const children = rule.literal ? [{ text: match[1] }] : parseInline(match[1]);

    return [
        ...(before ? [{ text: before }] : []),
        { tag: rule.tag, children },
        ...parseInline(text.slice(match.index + match[0].length)),
    ];
}
