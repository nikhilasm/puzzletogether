/**
 * The kakuro puzzle module: the four methods every puzzle type implements (design-spec.md §7);
 * completion and checking are the shared value-grid implementations, and what is kakuro's own is its
 * structure printed on the blocked squares as sums either side of a diagonal (ADR-0014). The
 * alphabet is 1 to 9 whatever the grid's side, so a 7×7 and a 13×13 take the same keypad.
 */

import { randomUUID } from 'node:crypto';

import { OP_TYPE } from '../../../shared/protocol.js';
import { isEditable } from '../../../shared/puzzle-doc.js';
import { checkCellsByValue, isCompleteByValue } from '../value-grid.js';

import { generateKakuro } from './generate.js';
import { ACROSS, clueSquare } from './runs.js';

/** Document schema version for kakuro docs, bumped if the shape of meta ever changes. */
const DOC_VERSION = 1;

/**
 * The digits a kakuro square may hold.
 *
 * Carried in each document's meta like every other type's, so the board and the keypad read what
 * this puzzle uses rather than knowing what kakuro uses.
 */
export const ALPHABET = '123456789';

/** Grid sides this module generates, counting the clue border (shared/constants.js). */
const MIN_SIDE = 7;
const MAX_SIDE = 13;

/**
 * The doc's cell list: open squares, printed squares, and the clue squares that carry the sums. A
 * blocked square with no run leaving it carries a null clue rather than a pair of nulls, which is how
 * the board decides whether to draw a diagonal.
 */
function toDocCells(n, { white, runs, solution, givens }) {
    const clues = new Array(n * n).fill(null);
    for (const run of runs) {
        const square = clueSquare(run, n);
        const clue = clues[square] ?? { across: null, down: null };
        if (run.dir === ACROSS) clue.across = run.sum;
        else clue.down = run.sum;
        clues[square] = clue;
    }

    const printed = new Set(givens);
    return Array.from({ length: n * n }, (_unused, idx) => ({
        block: !white[idx],
        given: printed.has(idx) ? String(solution[idx]) : null,
        label: null,
        clue: white[idx] ? null : clues[idx],
    }));
}

export default {
    type: 'kakuro',

    /**
     * Generates a kakuro puzzle and its solution.
     *
     * @param {object} options - Generation options.
     * @param {string} options.difficulty - Requested difficulty.
     * @param {import('../../../shared/protocol.js').GridSize} options.size - Grid dimensions;
     *   kakuro requires rows === cols, and counts the clue border in them.
     * @param {import('../rng.js').Rng} options.rng - Seeded generator.
     * @returns {{ doc: import('../../../shared/protocol.js').PuzzleDoc, solution: string[] }}
     *   The client-safe document and the solution, which never leaves the server.
     * @throws {RangeError} If the requested size is not a square side kakuro offers.
     */
    create({ difficulty, size, rng }) {
        const n = size.rows;
        if (size.rows !== size.cols || n < MIN_SIDE || n > MAX_SIDE) {
            throw new RangeError(`unsupported kakuro size: ${size.rows}x${size.cols}`);
        }

        const generated = generateKakuro({ difficulty, n, rng });
        const doc = {
            id: `kak-${randomUUID().slice(0, 8)}`,
            type: 'kakuro',
            version: DOC_VERSION,
            size: { rows: n, cols: n },
            // The measured rating, never the requested one; see rate.js.
            difficulty: generated.difficulty,
            title: null,
            author: null,
            source: 'generated',
            seed: rng.seed,
            cells: toDocCells(n, generated),
            meta: { alphabet: ALPHABET, runs: generated.runs },
        };

        // A blocked square holds nothing, so its solution entry is null: that is what lets the
        // shared value-grid comparison treat the clue border as already correct.
        const solution = Array.from(generated.solution, (digit, idx) =>
            generated.white[idx] ? String(digit) : null,
        );

        return { doc, solution };
    },

    /**
     * Whether an op is legal against this document: the square exists, is open, and any value is one
     * digit of the alphabet. The length check is load-bearing, since the schema admits up to 8
     * characters (ADR-0007), so nothing but this holds a kakuro square to one digit.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').Op} op - A schema-validated op.
     * @returns {boolean} True when the server may apply the op.
     */
    validateOp(doc, op) {
        if (op.t === OP_TYPE.FILL) return false;
        if (!isEditable(doc, op.cell)) return false;
        if (op.t === OP_TYPE.SET) {
            return op.value?.length === 1 && doc.meta.alphabet.includes(op.value);
        }
        if (op.t === OP_TYPE.MARKS) {
            return (op.marks ?? []).every((mark) => mark >= 1 && mark <= doc.meta.alphabet.length);
        }
        return true;
    },

    isComplete: isCompleteByValue,
    checkCells: checkCellsByValue,
};
