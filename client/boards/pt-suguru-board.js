/**
 * The suguru grid: region borders, a region-bounded keypad, and a cursor wash over the focused
 * region instead of a row and column.
 *
 * Everything else (cell DOM, selection, presence, op emission) comes from <pt-board>. The region
 * lookup follows kenken's #cageOf: built once per document, cached, and read by every hook that
 * needs to know which region a cell belongs to.
 */

import { PtBoard } from './pt-board.js';

/**
 * How many cells of the grid could ever legally hold a given digit: one per region at least that
 * big, since a region smaller than the digit can never take it and a region that size or larger
 * takes it exactly once (ADR-0019). Not doc.size.rows, which is what every other digit type uses
 * and assumes a full latin square; suguru has no row/column rule for that count to describe.
 *
 * A plain function rather than a board method, since the keypad needs it before any board element
 * has necessarily mounted (registry.js wires it in as BOARDS.suguru.keyCapacity).
 */
export function suguruKeyCapacity(doc, key) {
    const digit = Number(key);
    let count = 0;
    for (const region of doc.meta.regions) {
        if (region.cells.length >= digit) count += 1;
    }
    return count;
}

export class PtSuguruBoard extends PtBoard {
    /** Marks lay out in a square-ish block, as they do for sudoku and kenken. */
    get markColumns() {
        return Math.ceil(Math.sqrt(this.doc?.meta.alphabet.length ?? 6));
    }

    /** Enough rows to hold the whole alphabet at that width. */
    get markRows() {
        return Math.ceil((this.doc?.meta.alphabet.length ?? 6) / this.markColumns);
    }

    /**
     * Region membership and size by cell index, built once per document rather than searched per
     * cell. isHeavyRight, isHeavyBottom, valueForKey, and isHighlighted are all called on every
     * render, so a linear scan of meta.regions inside any of them would make drawing the grid
     * quadratic in its cells.
     */
    get #regionOf() {
        if (this.#regionCache?.doc !== this.doc) {
            const total = this.doc.size.rows * this.doc.size.cols;
            const owner = new Int32Array(total).fill(-1);
            const size = new Uint8Array(total);
            for (const region of this.doc.meta.regions) {
                for (const cell of region.cells) {
                    owner[cell] = region.id;
                    size[cell] = region.cells.length;
                }
            }
            this.#regionCache = { doc: this.doc, owner, size };
        }
        return this.#regionCache;
    }

    #regionCache = null;

    /** A region boundary, except at the right edge where the frame already draws one. */
    isHeavyRight(idx) {
        const col = idx % this.doc.size.cols;
        if (col + 1 >= this.doc.size.cols) return false;
        return this.#regionOf.owner[idx] !== this.#regionOf.owner[idx + 1];
    }

    /** As isHeavyRight, for the bottom edge of a region. */
    isHeavyBottom(idx) {
        const { rows, cols } = this.doc.size;
        const row = Math.floor(idx / cols);
        if (row + 1 >= rows) return false;
        return this.#regionOf.owner[idx] !== this.#regionOf.owner[idx + cols];
    }

    /**
     * Accepts a digit only up to the *selected cell's own* region size, not the puzzle's full
     * alphabet: a 3-cell region never takes a 4, even on a grid whose largest region is a 6
     * (ADR-0019). doc.meta.alphabet alone would let a key past that cell's own region through, since
     * it is sized to the puzzle's largest region rather than this one.
     */
    valueForKey(key) {
        if (!this.doc.meta.alphabet.includes(key)) return null;
        if (this.selection == null) return null;
        return Number(key) <= this.#regionOf.size[this.selection] ? key : null;
    }

    /**
     * Washes the focused cell's own region, not a row and column: suguru drops the row/column rule
     * every other digit type has, so the row and column mean nothing to a solver here, and what they
     * actually scan before writing a digit is the region and its neighbors (design-spec.md §7).
     */
    isHighlighted(idx) {
        if (this.selection == null) return false;
        return this.#regionOf.owner[idx] === this.#regionOf.owner[this.selection];
    }
}

customElements.define('pt-suguru-board', PtSuguruBoard);
