/**
 * The kakuro grid: clue squares, and a cursor that reads along runs. Most of this type's client
 * cost is elsewhere (pt-cell draws the clue squares from the document's sums, ADR-0014), so what is
 * left is what a keystroke writes and which squares the cursor implies, plus a small private run
 * index.
 */

import { toCoords } from '../../shared/puzzle-doc.js';

import { PtBoard } from './pt-board.js';

export class PtKakuroBoard extends PtBoard {
    /** Run membership by cell index, built once per document rather than searched per cell. */
    get #runsOf() {
        if (this.#runCache?.doc !== this.doc) {
            const index = new Array(this.doc.size.rows * this.doc.size.cols).fill(null);
            for (const run of this.doc.meta.runs) {
                for (const cell of run.cells) {
                    index[cell] = index[cell] ?? [];
                    index[cell].push(run);
                }
            }
            this.#runCache = { doc: this.doc, index };
        }
        return this.#runCache.index;
    }

    #runCache = null;

    /**
     * The two runs crossing the cursor, which is what a solver is reading. Not the base element's
     * row and column, since a kakuro row is several unrelated runs, the same argument as crossword's
     * entry highlight.
     */
    isHighlighted(idx) {
        if (this.selection == null) return false;
        return (this.#runsOf[this.selection] ?? []).some((run) => run.cells.includes(idx));
    }

    /**
     * Arrow keys skip the clue squares rather than stopping at them, always moving and never
     * turning. Stopping at a clue square would strand the cursor, since a kakuro's blocked squares
     * run through the middle of the grid.
     *
     * @param {number} from - Cell the selection is leaving.
     * @param {number} deltaRow - -1, 0, or 1.
     * @param {number} deltaCol - -1, 0, or 1.
     * @returns {number|null} The cell to select, or null to stay where it is.
     */
    nextSelection(from, deltaRow, deltaCol) {
        const size = this.doc.size;
        let { row, col } = toCoords(from, size);

        for (;;) {
            row += deltaRow;
            col += deltaCol;
            if (row < 0 || col < 0 || row >= size.rows || col >= size.cols) return null;
            const idx = row * size.cols + col;
            if (!this.doc.cells[idx].block) return idx;
        }
    }

    /** Accepts the nine digits, whatever the grid's side: a kakuro run draws on all of them. */
    valueForKey(key) {
        return this.doc.meta.alphabet.includes(key) ? key : null;
    }
}

customElements.define('pt-kakuro-board', PtKakuroBoard);
