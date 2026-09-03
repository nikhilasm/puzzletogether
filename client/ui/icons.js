/**
 * The icon set: inline SVG, drawn here rather than pulled from a pack.
 *
 * There are twenty-nine of them, they are all simple geometry, and a dependency would cost more
 * than it saves. Emoji are banned as UI icons (brand.md §1) because they render as somebody else's
 * artwork at somebody else's weight; these inherit currentColor and the app's line weight, so an
 * icon inside a disabled control greys out with it and the dark theme needs no second asset.
 *
 * Every icon is aria-hidden, and the control around it carries the accessible name. A one-word
 * label sits under the icon wherever these are drawn as a bar of controls in the app's own working
 * surface, which since ADR-0012 means the input panel. The footer's toolbar is the exception and
 * ADR-0023 is why: peripheral controls, pressed once a session or never, named by a tooltip on
 * hover and by their accessible name always.
 *
 * Geometry lives here; size and weight live in iconStyle, which each consuming component composes
 * into its own styles: shadow roots inherit properties, not rules.
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
 * Checking your work: a tick, the same idea --correct carries inside the grid.
 *
 * Deliberately not a magnifier. Check does not search the puzzle, it marks it, and the answer it
 * gives back is drawn on the cells as ticks and crosses, so the button wears the result it produces.
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
 * Filling a nonogram square: the mark itself, at the size the grid draws it.
 *
 * The only solid icon in the set. Everything else here is a stroked outline, and the exception is the
 * point: this button paints a block, so it wears one.
 */
export const fillIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" fill="currentColor" stroke="none" />
    </svg>
`;

/**
 * A caveat on a choice that is still available: the standard triangle, drawn at the app's own weight.
 *
 * Deliberately not red and not a stop sign. It marks an option that works but has a cost, so it has
 * to read as "know this" rather than "you cannot", and it never appears without words nearby, since
 * a bare triangle says only that *something* is wrong.
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
 * On to the next clue: a chevron, at the end of the clue it is moving off.
 *
 * Deliberately not the pair of swapped axes that used to sit here. That icon said "turn the cursor
 * around", and the bar it sat on no longer does that: pressing the clue walks down the column of
 * clues, so the icon has to say "forward" and nothing more. Turning around is what re-tapping the
 * square you are on does, which is the convention every crossword app already teaches.
 */
export const nextIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="m9 5 7 7-7 7" />
    </svg>
`;

/**
 * Rebus: more than one letter in a single square.
 *
 * The square is the cell, and the strokes inside it are the several characters that would not
 * ordinarily fit, which is the whole of what the toggle changes. Drawn rather than lettered because
 * a letterform in an icon is a word in disguise, and this button sits beside three others that are
 * all pure geometry.
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
 * Backspace, drawn the way every keyboard in the world draws it.
 *
 * This is the one icon in the set that is not free to be original. It sits in the bottom-right corner
 * of a pad of letters, which is exactly where a phone keyboard puts the same key, so a solver reads
 * it before they have consciously looked at it, and any cleverer shape would cost them that.
 */
export const backspaceIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9L3 12Z" />
        <path d="m11.5 9.5 5 5" />
        <path d="m16.5 9.5-5 5" />
    </svg>
`;

/**
 * About: the standard information mark, which is the one icon here that is a letterform.
 *
 * The rule against lettering in an icon (see rebus) is a rule about inventing one. This glyph is
 * not read as an "i": it has been the sign for "here is what this thing is" on every interface for
 * thirty years, and drawing something cleverer would only make it slower to find.
 */
export const infoIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5.5" />
        <path d="M12 7.6v.1" />
    </svg>
`;

/**
 * Starting another puzzle: a play triangle, which is the one shape that means "begin" outright.
 *
 * Deliberately not a circular arrow. "Again" would be the more literal reading of *start another*,
 * but a looping arrow is what undo already is at this line weight, and the two sit a modal apart
 * in the same session, and brand.md §4's rule that two icons meaning different things must look
 * different applies across the app, not only within one row.
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
 * How to play: a question mark, which is the shape of the question being asked.
 *
 * It sits where the info mark used to, and the swap is the difference between "here is what this
 * thing is" and "how does this work". The caption beside it already answers the first: it names the
 * type, the difficulty, and the size. What a solver still wants from it is the rules, and a question
 * mark is the one glyph that offers to answer a question rather than to describe something.
 *
 * The same letterform argument the info mark carries applies here and no more weakly: this is not
 * read as a punctuation character, it has been the sign for help on every interface for as long as
 * ⓘ has been the sign for about, and the two are drawn in the same ring so they stay a pair.
 */
export const helpIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7" />
        <path d="M12 16.9v.1" />
    </svg>
`;

/**
 * GitHub, drawn as GitHub draws it.
 *
 * The one borrowed mark in the set, and the one solid icon that is not solid because it paints
 * something solid (see fill). A logo is not a description, so there is nothing to redraw at this
 * app's line weight: an outlined approximation of the octocat is a worse octocat, and the whole
 * value of a brand mark is that it is recognised before it is read.
 *
 * Filled on the path rather than the svg, like fill's rect, because iconStyle's fill: none is a
 * rule and would beat an attribute on the element it matches.
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
 * The changelog: a written record, drawn as a sheet with a turned corner and three ruled lines.
 *
 * The turned corner is what keeps it apart from the list icon, which is also ruled lines and means
 * the crossword's clues (brand.md §4). List has no page around it and hangs a bullet off each rule;
 * this is a page first and lines second, which is what a log is: a document you read, not a set of
 * items you pick from. The two never share a row, and the rule is app-wide regardless.
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
 * The author's homepage: a house, which is the one shape that means "home" without a word.
 *
 * Not an arrow and not a globe. An arrow would say "back", which this is not: it leaves the app. A
 * globe says "somewhere on the web", which the GitHub mark two buttons along already says better.
 */
export const homeIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
        <path d="M9.5 20.5v-6h5v6" />
    </svg>
`;

/**
 * Reporting an issue: a flag, which is what "report this" has looked like on the web for years.
 *
 * Deliberately not the warning triangle. That one marks a choice the app is cautioning you about
 * and it appears elsewhere on the same session; two icons meaning different things must look
 * different (brand.md §4). A bug was the other candidate and says too little: the link takes you to
 * an issue tracker, which takes requests as readily as defects.
 */
export const flagIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M5.5 21V4" />
        <path d="M5.5 4.5h11l-2.2 4 2.2 4h-11Z" />
    </svg>
`;

/*
 * The six puzzle-type marks, which are one icon drawn six ways (ADR-0022).
 *
 * Every one of them is the same 2x2 of rounded cells on the same 24x24 box, and what tells them
 * apart is what is printed in the four squares: the type's own vocabulary, at the scale a solver
 * meets it on the board. They are identity marks rather than action icons, so they are the one
 * group here that carries letterforms, and they only ever appear on the puzzle-type tiles with the
 * type's name under them.
 *
 * Their parts need rules iconStyle does not give: a filled square, a washed one, a printed
 * character, and a region rule heavier than a grid line. Those live in typeIconStyle, which a
 * shadow root composes alongside iconStyle.
 */

/** Sizing and paint for the parts a type mark is built from. Compose alongside iconStyle. */
export const typeIconStyle = css`
    /*
     * The square the puzzle prints solid: a crossword block, a filled nonogram square.
     *
     * It keeps the stroke it inherits rather than dropping it, unlike the fill icon. A stroke is
     * drawn centred on the path, so an outlined cell is half a stroke bigger than its rect on every
     * side; a block with stroke: none came out a stroke narrower than the outlined square beside it,
     * which is visible at this size and reads as a wonky grid.
     */
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
 * Suguru: three squares drawn as one region, beside a fourth that is not in it.
 *
 * The region is the type, so it is one outline rather than three cells with a rule between them:
 * that is how a suguru board draws it, and it is the only thing separating this mark from the
 * sudoku one. Its digits run 1..n over the region, which is why the three inside it can hold 2, 1,
 * and 3 with no row or column saying otherwise.
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
 * The mark for each puzzle type, keyed by the value that travels over the wire.
 *
 * A map rather than a switch in the picker, so a new type adds a drawing here and nothing else.
 * A type with no entry renders no mark rather than a broken one, which is what makes the tile
 * degrade to the labelled button it used to be.
 */
export const puzzleTypeIcons = {
    crossword: crosswordIcon,
    sudoku: sudokuIcon,
    nonogram: nonogramIcon,
    kenken: kenkenIcon,
    kakuro: kakuroIcon,
    suguru: suguruIcon,
};
