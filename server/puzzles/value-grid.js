/**
 * The parts of the puzzle-module interface identical for every one-value-per-cell type (sudoku,
 * kenken, crossword): isComplete and checkCells compare effectiveValue to solution[idx] with nothing
 * type-specific. Nonogram does not use these, since it is complete when its filled cells match and
 * its x marks are notes, so it implements both itself.
 */

import { effectiveValue } from '../../shared/puzzle-doc.js';

/**
 * The value characters a grid of side n uses, in order.
 *
 * @param {number} n - Grid side length, at most 9.
 * @returns {string} The puzzle's alphabet, e.g. '1234' for a 4×4.
 */
export function digitAlphabet(n) {
    return '123456789'.slice(0, n);
}

/**
 * Whether the board matches the solution in every cell. Completion is decided on the server,
 * never claimed by a client.
 *
 * @param {import('../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
 * @param {import('../../shared/protocol.js').BoardState} board - Current board.
 * @param {string[]} solution - The full solution.
 * @returns {boolean} True when the puzzle is solved.
 */
export function isCompleteByValue(doc, board, solution) {
    for (let idx = 0; idx < solution.length; idx += 1) {
        if (effectiveValue(doc, board, idx) !== solution[idx]) return false;
    }
    return true;
}

/**
 * Classifies the requested cells against the solution, for the Check feature.
 *
 * @param {import('../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
 * @param {import('../../shared/protocol.js').BoardState} board - Current board.
 * @param {string[]} solution - The full solution.
 * @param {number[]} idxs - Cell indices to check.
 * @returns {Object<number, string>} Cell index to 'correct', 'wrong', or 'empty'.
 */
export function checkCellsByValue(doc, board, solution, idxs) {
    const result = {};
    for (const idx of idxs) {
        const value = effectiveValue(doc, board, idx);
        if (value == null) {
            result[idx] = 'empty';
        } else {
            result[idx] = value === solution[idx] ? 'correct' : 'wrong';
        }
    }
    return result;
}
