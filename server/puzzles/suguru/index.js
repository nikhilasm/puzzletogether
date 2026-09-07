/**
 * The suguru puzzle module: the four methods every puzzle type implements (design-spec.md §7).
 * Completion and checking are the shared value-grid implementations; what is suguru's own is the
 * region partition and its one unique rule, a value bounded by the size of the cell's region rather
 * than by one puzzle-wide alphabet (ADR-0019).
 */

import { randomUUID } from 'node:crypto';

import { OP_TYPE } from '../../../shared/protocol.js';
import { isEditable } from '../../../shared/puzzle-doc.js';
import { checkCellsByValue, digitAlphabet, isCompleteByValue } from '../value-grid.js';

import { generateSuguru } from './generate.js';

/** Document schema version for suguru docs, bumped if the shape of meta ever changes. */
const DOC_VERSION = 1;

/**
 * Grid sides this module generates. The floor is where up to 6-cell regions stop fitting comfortably;
 * the ceiling is where the dig loop's per-removal uniqueness check starts to cost real time.
 */
const MIN_SIDE = 5;
const MAX_SIDE = 9;

/**
 * A region size to cell index lookup, cached per document. A cell's legal digits are bounded by its
 * own region's size, not by doc.meta.alphabet (ADR-0019), so this is built once per document rather
 * than searched per op, the server-side twin of pt-suguru-board.js's cache.
 */
const sizeCache = new WeakMap();

/** The region size of each cell in a document, building and caching the lookup on first use. */
function regionSizeOf(doc) {
    let sizes = sizeCache.get(doc);
    if (!sizes) {
        sizes = new Uint8Array(doc.size.rows * doc.size.cols);
        for (const region of doc.meta.regions) {
            for (const cell of region.cells) sizes[cell] = region.cells.length;
        }
        sizeCache.set(doc, sizes);
    }
    return sizes;
}

/** The doc's cell list: a given where the puzzle dug no hole, blank everywhere it did. */
function toDocCells(cells) {
    return Array.from(cells, (value) => ({
        block: false,
        given: value === 0 ? null : String(value),
        label: null,
    }));
}

export default {
    type: 'suguru',

    /**
     * Generates a suguru puzzle and its solution.
     *
     * @param {object} options - Generation options.
     * @param {string} options.difficulty - Requested difficulty.
     * @param {import('../../../shared/protocol.js').GridSize} options.size - Grid dimensions;
     *   suguru requires rows === cols.
     * @param {import('../rng.js').Rng} options.rng - Seeded generator.
     * @returns {{ doc: import('../../../shared/protocol.js').PuzzleDoc, solution: string[] }}
     *   The client-safe document and the solution, which never leaves the server.
     * @throws {RangeError} If the requested size is not a square side suguru offers.
     */
    create({ difficulty, size, rng }) {
        const n = size.rows;
        if (size.rows !== size.cols || n < MIN_SIDE || n > MAX_SIDE) {
            throw new RangeError(`unsupported suguru size: ${size.rows}x${size.cols}`);
        }

        const generated = generateSuguru({ difficulty, n, rng });
        const maxRegion = Math.max(...generated.regions.map((region) => region.cells.length));
        const doc = {
            id: `sug-${randomUUID().slice(0, 8)}`,
            type: 'suguru',
            version: DOC_VERSION,
            size: { rows: n, cols: n },
            // The measured rating, never the requested one; see rate.js.
            difficulty: generated.difficulty,
            title: null,
            author: null,
            source: 'generated',
            seed: rng.seed,
            cells: toDocCells(generated.cells),
            meta: { regions: generated.regions, alphabet: digitAlphabet(maxRegion) },
        };

        return { doc, solution: Array.from(generated.solution, (value) => String(value)) };
    },

    /**
     * Whether an op is legal against this document: the cell exists, is editable, and any value is one
     * digit no larger than the size of the cell's own region. doc.meta.alphabet is the puzzle's full
     * display range, so a smaller region's cells accept a strict subset of it (ADR-0019), and the
     * length check holds a cell to one digit since the schema admits up to 8 characters (ADR-0007).
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').Op} op - A schema-validated op.
     * @returns {boolean} True when the server may apply the op.
     */
    validateOp(doc, op) {
        if (op.t === OP_TYPE.FILL) return false;
        if (!isEditable(doc, op.cell)) return false;
        if (op.t === OP_TYPE.SET) {
            if (op.value?.length !== 1 || !doc.meta.alphabet.includes(op.value)) return false;
            return Number(op.value) <= regionSizeOf(doc)[op.cell];
        }
        if (op.t === OP_TYPE.MARKS) {
            return (op.marks ?? []).every(
                (mark) => mark >= 1 && mark <= regionSizeOf(doc)[op.cell],
            );
        }
        return true;
    },

    isComplete: isCompleteByValue,
    checkCells: checkCellsByValue,
};
