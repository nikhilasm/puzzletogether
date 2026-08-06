/**
 * The nonogram puzzle module: the four methods every puzzle type implements (design-spec.md §7).
 *
 * Nonogram is the type that tests the abstraction hardest, and the two places it does not reuse are
 * both real differences rather than accidents:
 *
 * - **A cell is tri-state**, not a digit. The wire values are single characters (`#` and `x`), and
 *   `validateOp` below is what holds them to that. It used to be the schema's job: every cell value
 *   was one character until crossword's rebus squares widened the bound to 8 (ADR-0007). Nothing
 *   changed here, because this module matched against an array of allowed values rather than
 *   searching a string, and an array `includes` cannot match a substring the way sudoku's did.
 * - **Completion counts fills only.** A cross is the player's note that a cell is empty, not an
 *   answer, so `isComplete` ignores them entirely and a grid solves whether or not the player marked
 *   the blanks. That is why this module cannot use the shared value-grid helpers.
 */

import { randomUUID } from 'node:crypto';

import { OP_TYPE } from '../../../shared/protocol.js';
import { effectiveValue, isEditable, isInBounds } from '../../../shared/puzzle-doc.js';

import { generateNonogram } from './generate.js';

/** Document schema version for nonogram docs, bumped if the shape of `meta` ever changes. */
const DOC_VERSION = 1;

/**
 * The two things a player can put in a cell.
 *
 * Carried in `meta` rather than agreed as a constant on both sides, so the client reads what this
 * puzzle uses instead of knowing what nonograms use. Single characters, to stay inside the schema's
 * cell-value rule.
 */
const VALUES = { fill: '#', cross: 'x' };

/** Grid sides this module generates. */
const MIN_SIDE = 5;
const MAX_SIDE = 20;

export default {
    type: 'nonogram',

    /**
     * Generates a nonogram and its solution.
     *
     * @param {object} options - Generation options.
     * @param {string} options.difficulty - Requested difficulty.
     * @param {import('../../../shared/protocol.js').GridSize} options.size - Grid dimensions.
     * @param {import('../rng.js').Rng} options.rng - Seeded generator.
     * @returns {{ doc: import('../../../shared/protocol.js').PuzzleDoc, solution: string[] }}
     *   The client-safe document and the solution, which never leaves the server.
     * @throws {RangeError} If the requested size is not one nonogram offers.
     */
    create({ difficulty, size, rng }) {
        const { rows, cols } = size;
        if (rows !== cols || rows < MIN_SIDE || rows > MAX_SIDE) {
            throw new RangeError(`unsupported nonogram size: ${rows}x${cols}`);
        }

        const generated = generateNonogram({ difficulty, rows, cols, rng });
        const doc = {
            id: `non-${randomUUID().slice(0, 8)}`,
            type: 'nonogram',
            version: DOC_VERSION,
            size: { rows, cols },
            // The measured rating, never the requested one — see generate.js.
            difficulty: generated.difficulty,
            title: null,
            author: null,
            source: 'generated',
            seed: rng.seed,
            cells: Array.from({ length: rows * cols }, () => ({
                block: false,
                given: null,
                label: null,
            })),
            meta: { rowClues: generated.rowClues, colClues: generated.colClues, values: VALUES },
        };

        // A blank cell is `null` rather than the cross character: the solution says which cells are
        // filled, and marking the rest is the player's business.
        const solution = Array.from(generated.cells, (cell) => (cell ? VALUES.fill : null));
        return { doc, solution };
    },

    /**
     * Whether an op is legal against this document.
     *
     * The batched `fill` op is accepted here and nowhere else — it is what a drag across the grid
     * becomes, so that painting twenty cells is one write rather than twenty.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').Op} op - A schema-validated op.
     * @returns {boolean} True when the server may apply the op.
     */
    validateOp(doc, op) {
        // Nonogram has no pencil marks: the cross *is* the note, and it lives in the cell's value.
        if (op.t === OP_TYPE.MARKS) return false;

        const allowed = [VALUES.fill, VALUES.cross];
        if (op.t === OP_TYPE.FILL) {
            const cells = op.cells ?? [];
            if (cells.length === 0) return false;
            if (!cells.every((cell) => isInBounds(cell, doc.size))) return false;
            return op.value == null || allowed.includes(op.value);
        }

        if (!isEditable(doc, op.cell)) return false;
        if (op.t === OP_TYPE.SET) return op.value != null && allowed.includes(op.value);
        return true;
    },

    /**
     * Whether every cell the picture fills is filled, and no cell it leaves blank is.
     *
     * A player's crosses are ignored: they are notes about where the picture is not, so a grid is
     * solved whether they marked the blanks or left them alone.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').BoardState} board - Current board.
     * @param {(string|null)[]} solution - The fill character per filled cell, null elsewhere.
     * @returns {boolean} True when the puzzle is solved.
     */
    isComplete(doc, board, solution) {
        for (let idx = 0; idx < solution.length; idx += 1) {
            const filled = effectiveValue(doc, board, idx) === VALUES.fill;
            if (filled !== (solution[idx] === VALUES.fill)) return false;
        }
        return true;
    },

    /**
     * Classifies the requested cells against the picture, for the Check feature.
     *
     * Only fills are judged. A cross sits where the player believes nothing goes, so it is graded on
     * that belief — right when the cell is genuinely blank — while a cell left untouched is
     * `'empty'` rather than wrong, because saying nothing is not a mistake.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').BoardState} board - Current board.
     * @param {(string|null)[]} solution - The full solution.
     * @param {number[]} idxs - Cell indices to check.
     * @returns {Object<number, string>} Cell index to `'correct'`, `'wrong'`, or `'empty'`.
     */
    checkCells(doc, board, solution, idxs) {
        const result = {};
        for (const idx of idxs) {
            const value = effectiveValue(doc, board, idx);
            const shouldFill = solution[idx] === VALUES.fill;

            if (value == null) {
                result[idx] = 'empty';
            } else if (value === VALUES.fill) {
                result[idx] = shouldFill ? 'correct' : 'wrong';
            } else {
                result[idx] = shouldFill ? 'wrong' : 'correct';
            }
        }
        return result;
    },
};
