/**
 * The kenken grid: cage borders and digit input.
 *
 * Everything else (cell DOM, selection, presence, op emission) comes from <pt-board>. The cage
 * labels need no rendering code: DocCell.label already draws in a cell's top-left corner, which is
 * where a cage clue goes, so the server writes the label and this file only says where it sits
 * relative to the notes.
 *
 * The heavy rules are the same hook sudoku uses, asking a different question. Sudoku asks "is this
 * the edge of a region", which it computes from the region shape; kenken asks "is my neighbour in a
 * different cage", which it reads off the cage map. Neither needed a change to <pt-board>; this
 * is the abstraction doing what design-spec.md §7 says it does.
 */

import { PtBoard } from './pt-board.js';

/**
 * Cage operators as words.
 *
 * The drawn symbols are typographic rather than ASCII, since − is a true minus sign and not a
 * hyphen, and how a screen reader handles them is a verbosity setting rather than a promise: at the
 * one, punctuation is skipped, so 12+ and 12 say the same thing while meaning nothing alike.
 */
const SPOKEN_OP = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' };

export class PtKenkenBoard extends PtBoard {
    /** Marks lay out in a square-ish block, as they do for sudoku: 2 columns up to 4×4, 3 above. */
    get markColumns() {
        return Math.ceil(Math.sqrt(this.doc?.meta.alphabet.length ?? 4));
    }

    /** Enough rows to hold the whole alphabet at that width. */
    get markRows() {
        return Math.ceil((this.doc?.meta.alphabet.length ?? 4) / this.markColumns);
    }

    /**
     * The cage clue gets a row of the mark grid to itself.
     *
     * Kenken is the one type so far whose cells carry both a clue and notes, and both are drawn in
     * the top-left corner, the clue because that is where a kenken clue goes and the note "1"
     * because a mark's position is what says which digit it is. The marks paint after the label, so a cell
     * with a full set of notes hid its own clue. Giving the clue a row costs the notes one row of
     * height and settles it for good.
     */
    get reservesLabelRow() {
        return true;
    }

    /**
     * The cage clue said as arithmetic: 12+ becomes "cage 12 plus".
     *
     * Named as a cage, because otherwise the clue and the digit written in the cell arrive as two
     * bare numbers in a row and nothing says which is which. A single-cell cage is drawn as its
     * target alone and is spoken the same way, since there is no operator to name.
     *
     * @param {string} label - The cage clue as drawn.
     * @returns {string} The clue as a screen reader should say it.
     */
    spokenLabel(label) {
        const op = SPOKEN_OP[label.at(-1)];
        return op ? `cage ${label.slice(0, -1)} ${op}` : `cage ${label}`;
    }

    /**
     * Cage membership by cell index, built once per document rather than searched per cell.
     *
     * isHeavyRight and isHeavyBottom are called for every cell on every board render, and a
     * linear scan of the cage list inside them would make drawing the grid quadratic in its cells.
     */
    get #cageOf() {
        if (this.#cageCache?.doc !== this.doc) {
            const owner = new Int32Array(this.doc.size.rows * this.doc.size.cols).fill(-1);
            for (const cage of this.doc.meta.cages) {
                for (const cell of cage.cells) owner[cell] = cage.id;
            }
            this.#cageCache = { doc: this.doc, owner };
        }
        return this.#cageCache.owner;
    }

    #cageCache = null;

    /** A cage boundary, except at the right edge where the frame already draws one. */
    isHeavyRight(idx) {
        const col = idx % this.doc.size.cols;
        if (col + 1 >= this.doc.size.cols) return false;
        return this.#cageOf[idx] !== this.#cageOf[idx + 1];
    }

    /** As isHeavyRight, for the bottom edge of a cage. */
    isHeavyBottom(idx) {
        const { rows, cols } = this.doc.size;
        const row = Math.floor(idx / cols);
        if (row + 1 >= rows) return false;
        return this.#cageOf[idx] !== this.#cageOf[idx + cols];
    }

    /** Accepts only digits in this puzzle's alphabet, so a 4×4 never takes a 7. */
    valueForKey(key) {
        return this.doc.meta.alphabet.includes(key) ? key : null;
    }
}

customElements.define('pt-kenken-board', PtKenkenBoard);
