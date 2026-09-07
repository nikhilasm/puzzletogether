/**
 * Reads CHANGELOG.md into the releases pt-changelog draws, in a deliberately small format: a
 * heading opens a release, a hyphen bullet is one change, every other line is ignored. A change
 * carries five inline spans (bold, italic, code, strikethrough, underline) returned as spans rather
 * than an HTML string, so a stray angle bracket stays text.
 *
 *     ## 1.2.0 - 2026-09-03
 *
 *     - One change, one sentence, with **bold** or `code` where it earns it.
 */

/** A release heading: two hashes, a semver version, a hyphen, an ISO date. A leading v is allowed. */
const HEADING = /^##\s+v?(\d+)\.(\d+)\.(\d+)\s+-\s+(\d{4}-\d{2}-\d{2})$/;

/** One change: a hyphen, a space, and the text. The space is what keeps a --- rule out. */
const CHANGE = /^-\s+(\S.*)$/;

/**
 * The inline spans a change may carry, in the order they are tried: code first since it is literal,
 * and two stars before one so a bold run does not open as italic. Underline uses the u tag as its
 * delimiter since Markdown has no syntax for it, and that tag is a delimiter, not permission to
 * write HTML.
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
 * Parses changelog text into releases, in the order the file lists them. Never throws: an
 * unrecognised line is skipped, since a malformed heading should cost one entry rather than blank
 * the dialog.
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
 * Splits one change into the spans the dialog draws, recursing so spans can nest. The leftmost
 * delimiter wins, ties go to INLINE's order, and an unclosed delimiter is treated as text.
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
