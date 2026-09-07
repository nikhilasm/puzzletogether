/**
 * Which board element renders each puzzle type, and what kind of input it takes, declared here so
 * adding a type is one entry rather than a branch inside pt-game (design-spec.md §7). input is a
 * small closed vocabulary grouping puzzles by how a player enters a cell; crossword uses a drawn
 * letter pad rather than the platform keyboard (ADR-0010, reversing ADR-0008).
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
