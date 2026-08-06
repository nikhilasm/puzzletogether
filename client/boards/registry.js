/**
 * Which board element renders each puzzle type, and what kind of input it takes.
 *
 * The game screen has to know two things about a puzzle it has never heard of: what to render it
 * with, and what to put in the control slot beneath it. Both are declared here so that adding a type
 * is one entry rather than a branch inside `<pt-game>` — a type check there would be exactly the cost
 * design-spec.md §7 says a new type must not have.
 *
 * `input` is a small closed vocabulary, not a type name. It groups puzzles by the question "how does
 * a player put something in a cell?", which has far fewer answers than there are puzzle types:
 * sudoku and kenken share `digits` despite having nothing else in common.
 *
 * Crossword is `letters` rather than the `native` this file guessed at in Phase 1. Handing a
 * crossword to the phone's own keyboard means fighting autocapitalize and predictive text, ceding an
 * unknowable share of the viewport on a 15×15, and maintaining the offscreen-`<input>` trick per
 * platform — so it gets a pad of ours, in the slot the digits and brushes already use
 * (design-spec.md §4).
 */

import { literal } from 'lit/static-html.js';

import './pt-crossword-board.js';
import './pt-kenken-board.js';
import './pt-nonogram-board.js';
import './pt-sudoku-board.js';

/** Board element and input style per puzzle type. */
export const BOARDS = {
    sudoku: { tag: literal`pt-sudoku-board`, input: 'digits' },
    kenken: { tag: literal`pt-kenken-board`, input: 'digits' },
    nonogram: { tag: literal`pt-nonogram-board`, input: 'brushes' },
    crossword: { tag: literal`pt-crossword-board`, input: 'letters' },
};

/**
 * The board entry for a puzzle type.
 *
 * @param {string} type - The `doc.type` of the puzzle being rendered.
 * @returns {{ tag: unknown, input: string }} The element to render it with and its input style.
 * @throws {RangeError} If the build has no board for the type, which means a server module shipped
 *   without its client half.
 */
export function boardFor(type) {
    const board = BOARDS[type];
    if (!board) throw new RangeError(`no board element for puzzle type: ${type}`);
    return board;
}
