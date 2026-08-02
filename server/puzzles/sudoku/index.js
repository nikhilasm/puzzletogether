/**
 * The sudoku puzzle module: the four methods every puzzle type implements (design-spec.md §7).
 *
 * Nothing outside this directory knows how sudoku is generated or checked. Adding a fifth puzzle
 * type means writing a sibling of this file and one `<pt-board>` subclass — nothing else.
 */

import { randomUUID } from 'node:crypto';

import { OP_TYPE } from '../../../shared/protocol.js';
import { effectiveValue, isEditable } from '../../../shared/puzzle-doc.js';

import { generateSudoku } from './generate.js';

/** Document schema version for sudoku docs, bumped if the shape of `meta` ever changes. */
const DOC_VERSION = 1;

/** Region shape per grid size, mirrored into `meta` so the client can draw the heavy borders. */
const REGION_SHAPES = {
    4: { regionRows: 2, regionCols: 2 },
    6: { regionRows: 2, regionCols: 3 },
    9: { regionRows: 3, regionCols: 3 },
};

/** The value characters a grid of side `n` uses, in order. */
function alphabetFor(n) {
    return '123456789'.slice(0, n);
}

/** Converts a generated numeric grid into the doc's client-safe cell list. */
function toDocCells(cells) {
    return Array.from(cells, (value) => ({
        block: false,
        given: value === 0 ? null : String(value),
        label: null,
    }));
}

export default {
    type: 'sudoku',

    /**
     * Generates a sudoku puzzle and its solution.
     *
     * @param {object} options - Generation options.
     * @param {string} options.difficulty - Requested difficulty.
     * @param {import('../../../shared/protocol.js').GridSize} options.size - Grid dimensions;
     *   sudoku requires `rows === cols`.
     * @param {import('../rng.js').Rng} options.rng - Seeded generator.
     * @returns {{ doc: import('../../../shared/protocol.js').PuzzleDoc, solution: string[] }}
     *   The client-safe document and the solution, which never leaves the server.
     * @throws {RangeError} If the requested size is not a square supported sudoku size.
     */
    create({ difficulty, size, rng }) {
        const n = size.rows;
        if (size.rows !== size.cols || !REGION_SHAPES[n]) {
            throw new RangeError(`unsupported sudoku size: ${size.rows}x${size.cols}`);
        }

        const generated = generateSudoku({ difficulty, n, rng });
        const doc = {
            id: `sud-${randomUUID().slice(0, 8)}`,
            type: 'sudoku',
            version: DOC_VERSION,
            size: { rows: n, cols: n },
            difficulty: generated.difficulty,
            title: null,
            author: null,
            source: 'generated',
            seed: rng.seed,
            cells: toDocCells(generated.cells),
            meta: { ...REGION_SHAPES[n], alphabet: alphabetFor(n) },
        };

        return { doc, solution: Array.from(generated.solution, (value) => String(value)) };
    },

    /**
     * Whether an op is legal against this document — the cell exists, is editable, and any value
     * is in the puzzle's alphabet.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').Op} op - A schema-validated op.
     * @returns {boolean} True when the server may apply the op.
     */
    validateOp(doc, op) {
        if (op.t === OP_TYPE.FILL) return false;
        if (!isEditable(doc, op.cell)) return false;
        if (op.t === OP_TYPE.SET) {
            return op.value != null && doc.meta.alphabet.includes(op.value);
        }
        if (op.t === OP_TYPE.MARKS) {
            return (op.marks ?? []).every((mark) => mark >= 1 && mark <= doc.size.rows);
        }
        return true;
    },

    /**
     * Whether the board matches the solution in every cell. Completion is decided here, on the
     * server, never claimed by a client.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').BoardState} board - Current board.
     * @param {string[]} solution - The full solution.
     * @returns {boolean} True when the puzzle is solved.
     */
    isComplete(doc, board, solution) {
        for (let idx = 0; idx < solution.length; idx += 1) {
            if (effectiveValue(doc, board, idx) !== solution[idx]) return false;
        }
        return true;
    },

    /**
     * Classifies the requested cells against the solution, for the Check feature.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').BoardState} board - Current board.
     * @param {string[]} solution - The full solution.
     * @param {number[]} idxs - Cell indices to check.
     * @returns {Object<number, string>} Cell index to `'correct'`, `'wrong'`, or `'empty'`.
     */
    checkCells(doc, board, solution, idxs) {
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
    },
};
