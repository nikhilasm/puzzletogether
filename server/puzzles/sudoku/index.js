/**
 * The sudoku puzzle module: the four methods every puzzle type implements (design-spec.md §7).
 * Adding a type means writing a sibling of this file and one pt-board subclass, nothing else.
 */

import { randomUUID } from 'node:crypto';

import { OP_TYPE } from '../../../shared/protocol.js';
import { isEditable } from '../../../shared/puzzle-doc.js';
import { checkCellsByValue, digitAlphabet, isCompleteByValue } from '../value-grid.js';

import { generateSudoku } from './generate.js';

/** Document schema version for sudoku docs, bumped if the shape of meta ever changes. */
const DOC_VERSION = 1;

/** Region shape per grid size, mirrored into meta so the client can draw the heavy borders. */
const REGION_SHAPES = {
    4: { regionRows: 2, regionCols: 2 },
    6: { regionRows: 2, regionCols: 3 },
    9: { regionRows: 3, regionCols: 3 },
};

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
     *   sudoku requires rows === cols.
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
            meta: { ...REGION_SHAPES[n], alphabet: digitAlphabet(n) },
        };

        return { doc, solution: Array.from(generated.solution, (value) => String(value)) };
    },

    /**
     * Whether an op is legal against this document: the cell exists, is editable, and any value is
     * one character of the alphabet. The length check is not redundant, since schema.js bounds a
     * value at 8 characters (ADR-0007), so this is the only thing keeping a sudoku cell to a digit.
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
            return (op.marks ?? []).every((mark) => mark >= 1 && mark <= doc.size.rows);
        }
        return true;
    },

    isComplete: isCompleteByValue,
    checkCells: checkCellsByValue,
};
