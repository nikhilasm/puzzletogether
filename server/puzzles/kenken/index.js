/**
 * The kenken puzzle module: the four methods every puzzle type implements (design-spec.md §7).
 * Completion and checking are the shared value-grid implementations, so the only thing written here
 * is what makes kenken kenken: cages.
 */

import { randomUUID } from 'node:crypto';

import { OP_TYPE } from '../../../shared/protocol.js';
import { isEditable } from '../../../shared/puzzle-doc.js';
import { checkCellsByValue, digitAlphabet, isCompleteByValue } from '../value-grid.js';

import { cageLabel } from './cages.js';
import { generateKenken } from './generate.js';

/** Document schema version for kenken docs, bumped if the shape of meta ever changes. */
const DOC_VERSION = 1;

/** Grid sides this module generates. The ceiling is where uniqueness cost climbs (§8). */
const MIN_SIDE = 4;
const MAX_SIDE = 7;

/**
 * The doc's cell list: every cell editable, with the clue drawn on each cage's top-left cell. A
 * kenken has no givens, since even a single-cell cage is a clue the player writes in, so given stays
 * null across the grid.
 */
function toDocCells(total, cages) {
    const labels = new Array(total).fill(null);
    for (const cage of cages) labels[cage.cells[0]] = cageLabel(cage);

    return Array.from(labels, (label) => ({ block: false, given: null, label }));
}

export default {
    type: 'kenken',

    /**
     * Generates a kenken puzzle and its solution.
     *
     * @param {object} options - Generation options.
     * @param {string} options.difficulty - Requested difficulty.
     * @param {import('../../../shared/protocol.js').GridSize} options.size - Grid dimensions;
     *   kenken requires rows === cols.
     * @param {import('../rng.js').Rng} options.rng - Seeded generator.
     * @returns {{ doc: import('../../../shared/protocol.js').PuzzleDoc, solution: string[] }}
     *   The client-safe document and the solution, which never leaves the server.
     * @throws {RangeError} If the requested size is not a square side kenken offers.
     */
    create({ difficulty, size, rng }) {
        const n = size.rows;
        if (size.rows !== size.cols || n < MIN_SIDE || n > MAX_SIDE) {
            throw new RangeError(`unsupported kenken size: ${size.rows}x${size.cols}`);
        }

        const { cages, solution } = generateKenken({ difficulty, n, rng });
        const doc = {
            id: `kk-${randomUUID().slice(0, 8)}`,
            type: 'kenken',
            version: DOC_VERSION,
            size: { rows: n, cols: n },
            // The difficulty asked for, because kenken's is a generation parameter rather than a
            // measurement; see the header of cages.js for why the two types differ here.
            difficulty,
            title: null,
            author: null,
            source: 'generated',
            seed: rng.seed,
            cells: toDocCells(n * n, cages),
            meta: { cages, alphabet: digitAlphabet(n) },
        };

        return { doc, solution: Array.from(solution, (value) => String(value)) };
    },

    /**
     * Whether an op is legal against this document: the cell exists, is editable, and any value is
     * one character of the alphabet. The length check carries real weight, since the schema admits
     * up to 8 characters (ADR-0007), so this is the only thing keeping a kenken cell to one digit.
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
