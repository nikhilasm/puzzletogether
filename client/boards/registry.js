/**
 * Which board element renders each puzzle type, and what kind of input it takes.
 *
 * The game screen has to know two things about a puzzle it has never heard of: what to render it
 * with, and what to put in the control slot beneath it. Both are declared here so that adding a type
 * is one entry rather than a branch inside <pt-game>; a type check there would be exactly the cost
 * design-spec.md §7 says a new type must not have.
 *
 * input is a small closed vocabulary, not a type name. It groups puzzles by the question "how does
 * a player put something in a cell?", which has far fewer answers than there are puzzle types:
 * sudoku and kenken share digits despite having nothing else in common.
 *
 * Crossword is letters: a pad of our own, which is where this landed after trying the platform
 * keyboard on a real phone. The keyboard's letters were fine; everything around them was not. Half
 * the actions a solver takes dismiss it, and a control bar pinned above it has to be positioned off
 * visualViewport and still drifts. A pad we draw costs a share of the screen and gives back a
 * layout that does not move (ADR-0010, reversing ADR-0008).
 */

import { literal } from 'lit/static-html.js';

import './pt-crossword-board.js';
import './pt-kakuro-board.js';
import './pt-kenken-board.js';
import './pt-nonogram-board.js';
import './pt-sudoku-board.js';
import { suguruKeyCapacity } from './pt-suguru-board.js';

/**
 * Board element, input style, and (where a digit's ceiling is not the grid side) how many of it
 * the keypad should ever expect, per puzzle type.
 *
 * keyCapacity is optional: every type but suguru is a full latin square, where a digit's ceiling
 * is just doc.size.rows, which is the fallback pt-game.js uses when a type omits it.
 */
export const BOARDS = {
    sudoku: { tag: literal`pt-sudoku-board`, input: 'digits' },
    kenken: { tag: literal`pt-kenken-board`, input: 'digits' },
    nonogram: { tag: literal`pt-nonogram-board`, input: 'brushes' },
    kakuro: { tag: literal`pt-kakuro-board`, input: 'digits' },
    crossword: { tag: literal`pt-crossword-board`, input: 'letters' },
    suguru: { tag: literal`pt-suguru-board`, input: 'digits', keyCapacity: suguruKeyCapacity },
};

/**
 * The board entry for a puzzle type.
 *
 * @param {string} type - The doc.type of the puzzle being rendered.
 * @returns {{ tag: unknown, input: string, keyCapacity?: (doc: object, key: string) => number }}
 *   The element to render it with, its input style, and, if it has one, its own way of capping how
 *   many of a key the keypad should expect.
 * @throws {RangeError} If the build has no board for the type, which means a server module shipped
 *   without its client half.
 */
export function boardFor(type) {
    const board = BOARDS[type];
    if (!board) throw new RangeError(`no board element for puzzle type: ${type}`);
    return board;
}
