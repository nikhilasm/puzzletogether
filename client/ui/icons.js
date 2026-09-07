/**
 * The icon set: inline SVG, drawn here rather than pulled from a pack, since a dependency would cost
 * more than twenty-nine pieces of simple geometry and these inherit currentColor and the app's line
 * weight (brand.md §1). Every icon is aria-hidden with the control carrying the name, and geometry
 * lives here while size and weight live in iconStyle, which each consuming component composes.
 */

import { css, html } from 'lit';

/** Sizing and stroke for any .icon in a shadow root that composes this. */
export const iconStyle = css`
    .icon {
        flex: none;
        width: 1.25em;
        height: 1.25em;
        fill: none;
        stroke: currentColor;
        stroke-width: var(--stroke-icon);
        stroke-linecap: round;
        stroke-linejoin: round;
    }
`;

/** An eraser at the angle you would hold it, over the line it has taken out. */
export const eraseIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
            d="M9 20 3.4 14.4a1.4 1.4 0 0 1 0-2L12.6 3.2a1.4 1.4 0 0 1 2 0l5.6 5.6a1.4 1.4 0 0 1 0 2L11 20Z"
        />
        <path d="M21 20H9" />
        <path d="m7 9.6 7.4 7.4" />
    </svg>
`;

/** An arrow doubling back on itself: the one shape everybody already reads as undo. */
export const undoIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M4 8h9.5a5.5 5.5 0 0 1 0 11H7" />
        <path d="m8 4-4 4 4 4" />
    </svg>
`;

/** Pencil marks: the same idea the --pencil colour carries inside the grid. */
export const pencilIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
            d="m4 20 .9-3.6a2 2 0 0 1 .5-.9L15.7 5.2a2 2 0 0 1 2.8 0l1.3 1.3a2 2 0 0 1 0 2.8L9.5 19.6a2 2 0 0 1-.9.5Z"
        />
        <path d="m14.5 6.5 3 3" />
    </svg>
`;

/** The light theme: "paper". */
export const sunIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        <path d="m4.9 4.9 1.5 1.5M17.6 17.6l1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </svg>
`;

/** Leaving a room: out through the doorway, not a power symbol, since nothing is being shut down. */
export const leaveIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
        <path d="m9 8-4 4 4 4" />
        <path d="M5 12h10" />
    </svg>
`;

/** Removing somebody. Small and unlabelled, so its control carries the name. */
export const closeIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="m7 7 10 10M17 7 7 17" />
    </svg>
`;

/**
 * Checking your work: a tick, the same idea --correct carries inside the grid. Deliberately not a
 * magnifier, since Check marks the puzzle rather than searching it.
 */
export const checkIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
`;

/** Revealing the answer: an eye, because the solution was always there and is being shown. */
export const revealIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
`;

/**
 * Puzzle Select: the choice of puzzles, drawn as a set rather than as a back arrow.
 *
 * The destination is what makes this button different from Leave room, which sits a few pixels
 * below it: two left arrows there would say the two controls do the same thing.
 */
export const puzzlesIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
`;

/**
 * Filling a nonogram square: the mark itself, at the size the grid draws it. The only solid icon in
 * the set, since this button paints a block.
 */
export const fillIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" fill="currentColor" stroke="none" />
    </svg>
`;

/**
 * A caveat on a choice that is still available: the standard triangle at the app's own weight. Not
 * red and not a stop sign, since it marks an option that works but has a cost, and it never appears
 * without words nearby.
 */
export const warningIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M12 3.8 21.2 19.5a1 1 0 0 1-.9 1.5H3.7a1 1 0 0 1-.9-1.5Z" />
        <path d="M12 9.5v4.2" />
        <path d="M12 17.2v.1" />
    </svg>
`;

/** The dark theme: "evening desk". */
export const moonIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
    </svg>
`;

/**
 * On to the next clue: a chevron, at the end of the clue it is moving off. Not the swapped axes that
 * used to sit here, since the bar now walks down the column of clues rather than turning the cursor
 * around.
 */
export const nextIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="m9 5 7 7-7 7" />
    </svg>
`;

/**
 * Rebus: more than one letter in a single square, the strokes inside the cell being the characters
 * that would not ordinarily fit. Drawn rather than lettered, since a letterform in an icon is a word
 * in disguise.
 */
export const rebusIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
        <path d="M8 10v4" />
        <path d="M12 9.5v5" />
        <path d="M16 10v4" />
    </svg>
`;

/**
 * Backspace, drawn the way every keyboard draws it. The one icon not free to be original, since a
 * solver reads it from its shape before looking at it.
 */
export const backspaceIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9L3 12Z" />
        <path d="m11.5 9.5 5 5" />
        <path d="m16.5 9.5-5 5" />
    </svg>
`;

/**
 * About: the standard information mark, the one icon here that is a letterform. The rule against
 * lettering (see rebus) is about inventing one, and this glyph has meant about on every interface
 * for thirty years.
 */
export const infoIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5.5" />
        <path d="M12 7.6v.1" />
    </svg>
`;

/**
 * Starting another puzzle: a play triangle, the one shape that means begin outright. Not a circular
 * arrow, which undo already is at this weight (brand.md §4).
 */
export const startIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M8 5.5 18.5 12 8 18.5Z" />
    </svg>
`;

/** Ruled lines with their bullets: the clue list. */
export const listIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M4 6.5h.01" />
        <path d="M4 12h.01" />
        <path d="M4 17.5h.01" />
        <path d="M9 6.5h11" />
        <path d="M9 12h11" />
        <path d="M9 17.5h11" />
    </svg>
`;

/**
 * How to play: a question mark, the shape of the question being asked, where the info mark used to
 * sit. The same letterform argument as the info mark applies: it has meant help for as long as the
 * info mark has meant about, and the two share a ring to stay a pair.
 */
export const helpIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7" />
        <path d="M12 16.9v.1" />
    </svg>
`;

/**
 * GitHub, drawn as GitHub draws it, the one borrowed mark in the set, since a logo is recognised
 * before it is read and cannot be improved by redrawing. Filled on the path rather than the svg,
 * since iconStyle's fill: none would beat an attribute.
 */
export const githubIcon = html`
    <svg viewBox="0 0 16 16" class="icon" aria-hidden="true">
        <path
            fill="currentColor"
            stroke="none"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
    </svg>
`;

/**
 * The changelog: a sheet with a turned corner and three ruled lines. The turned corner keeps it
 * apart from the list icon, which is also ruled lines but means the crossword's clues (brand.md §4).
 */
export const changelogIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
            d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5Z"
        />
        <path d="M14 3.5V8.5h5" />
        <path d="M8.5 12.5h7M8.5 16.5h7" />
    </svg>
`;

/**
 * The author's homepage: a house, the one shape that means home without a word. Not an arrow, which
 * would say back, nor a globe, which the GitHub mark already says better.
 */
export const homeIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
        <path d="M9.5 20.5v-6h5v6" />
    </svg>
`;

/**
 * Reporting an issue: a flag, what report this has looked like for years. Not the warning triangle,
 * which means something else on the same session (brand.md §4), and not a bug, since the tracker
 * takes requests as readily as defects.
 */
export const flagIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M5.5 21V4" />
        <path d="M5.5 4.5h11l-2.2 4 2.2 4h-11Z" />
    </svg>
`;

/*
 * The six puzzle-type marks, one icon drawn six ways (ADR-0022): the same 2x2 of rounded cells,
 * told apart by what is printed in the squares. Identity marks rather than action icons, so their
 * parts need rules iconStyle does not give, which live in typeIconStyle.
 */

/** Sizing and paint for the parts a type mark is built from. Compose alongside iconStyle. */
export const typeIconStyle = css`
    /* The square the puzzle prints solid; it keeps its inherited stroke, unlike the fill icon, so it
       stays the same size as the outlined squares beside it. */
    .icon .block {
        fill: currentColor;
    }

    /* A square that came with the puzzle, at the weight --given-fill gives a given on the board. */
    .icon .wash {
        fill: currentColor;
        fill-opacity: 0.18;
    }

    /* A character printed in a square. Filled, since iconStyle strokes everything else. */
    .icon .glyph {
        fill: currentColor;
        stroke: none;
        font-family: var(--font-ui);
        font-weight: 700;
        text-anchor: middle;
    }

    /* A region boundary, which outranks the cell edges the way it does inside a suguru. */
    .icon .heavy {
        stroke-width: calc(var(--stroke-icon) * 2);
    }
`;

/** Crossword: blocks on the diagonal, letters in the squares that take one. */
export const crosswordIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect class="block" x="1.5" y="1.5" width="10" height="10" rx="2" />
        <rect x="12.5" y="1.5" width="10" height="10" rx="2" />
        <text class="glyph" x="17.5" y="9" font-size="7">A</text>
        <rect x="1.5" y="12.5" width="10" height="10" rx="2" />
        <text class="glyph" x="6.5" y="20" font-size="7">B</text>
        <rect class="block" x="12.5" y="12.5" width="10" height="10" rx="2" />
    </svg>
`;

/** Sudoku: four digits, two of them printed as givens. */
export const sudokuIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect class="wash" x="1.5" y="1.5" width="10" height="10" rx="2" />
        <text class="glyph" x="6.5" y="9" font-size="7">1</text>
        <rect x="12.5" y="1.5" width="10" height="10" rx="2" />
        <text class="glyph" x="17.5" y="9" font-size="7">2</text>
        <rect x="1.5" y="12.5" width="10" height="10" rx="2" />
        <text class="glyph" x="6.5" y="20" font-size="7">3</text>
        <rect class="wash" x="12.5" y="12.5" width="10" height="10" rx="2" />
        <text class="glyph" x="17.5" y="20" font-size="7">4</text>
    </svg>
`;

/** Nonogram: the two marks a solver makes, filled and crossed, and a square still undecided. */
export const nonogramIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="1.5" y="1.5" width="10" height="10" rx="2" />
        <rect class="block" x="12.5" y="1.5" width="10" height="10" rx="2" />
        <rect class="block" x="1.5" y="12.5" width="10" height="10" rx="2" />
        <rect x="12.5" y="12.5" width="10" height="10" rx="2" />
        <path d="m15 15 5 5" />
        <path d="m20 15-5 5" />
    </svg>
`;

/** KenKen: the four operators a cage can carry, one to a square. */
export const kenkenIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="1.5" y="1.5" width="10" height="10" rx="2" />
        <path d="M3.5 6.5h6M6.5 3.5v6" />
        <rect x="12.5" y="1.5" width="10" height="10" rx="2" />
        <path d="M14.5 6.5h6" />
        <rect x="1.5" y="12.5" width="10" height="10" rx="2" />
        <path d="M3.5 17.5h6" />
        <path d="M6.5 14.9v.01" />
        <path d="M6.5 20.1v.01" />
        <rect x="12.5" y="12.5" width="10" height="10" rx="2" />
        <path d="m15.2 15.2 4.6 4.6" />
        <path d="m19.8 15.2-4.6 4.6" />
    </svg>
`;

/**
 * Kakuro: the split clue square, the digits answering it, and a square still to fill.
 *
 * The diagonal is what makes this one a kakuro rather than a crossword: it is the square that holds
 * two sums, which is the whole of what the type asks of a solver (ADR-0014).
 */
export const kakuroIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="1.5" y="1.5" width="10" height="10" rx="2" />
        <path d="m3 3 7 7" />
        <rect x="12.5" y="1.5" width="10" height="10" rx="2" />
        <text class="glyph" x="17.5" y="9" font-size="7">1</text>
        <rect x="1.5" y="12.5" width="10" height="10" rx="2" />
        <text class="glyph" x="6.5" y="20" font-size="7">2</text>
        <rect x="12.5" y="12.5" width="10" height="10" rx="2" />
    </svg>
`;

/**
 * Suguru: three squares drawn as one region, beside a fourth that is not in it. The region is the
 * type, so it is one outline rather than three cells, and its digits run 1..n with no row or column
 * rule.
 */
export const suguruIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
            class="heavy"
            d="M3.5 1.5H20.5a2 2 0 0 1 2 2V20.5a2 2 0 0 1-2 2H14.5a2 2 0 0 1-2-2V13.5a2 2 0 0 0-2-2H3.5a2 2 0 0 1-2-2V3.5a2 2 0 0 1 2-2Z"
        />
        <text class="glyph" x="6.5" y="9" font-size="7">2</text>
        <text class="glyph" x="17.5" y="9" font-size="7">1</text>
        <text class="glyph" x="17.5" y="20" font-size="7">3</text>
        <rect x="1.5" y="12.5" width="10" height="10" rx="2" />
    </svg>
`;

/**
 * The mark for each puzzle type, keyed by the wire value. A map rather than a switch, so a new type
 * adds a drawing here, and a type with no entry renders no mark rather than a broken one.
 */
export const puzzleTypeIcons = {
    crossword: crosswordIcon,
    sudoku: sudokuIcon,
    nonogram: nonogramIcon,
    kenken: kenkenIcon,
    kakuro: kakuroIcon,
    suguru: suguruIcon,
};
