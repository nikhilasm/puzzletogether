/**
 * The kakuro grid: clue squares, and a cursor that reads along runs.
 *
 * Almost all of this type's client cost is *not here*. The clue squares are drawn by <pt-cell> from
 * the pair of sums the document puts on them (ADR-0014), blocked squares already refuse the cursor,
 * and pencil marks already lay out three by three for the nine digits, so what is left is the two
 * questions every type answers about its own grid: what a keystroke writes, and which squares the
 * cursor implies.
 *
 * The run index is a private cache rather than a module of its own, following kenken's cage lookup.
 * Crossword's entries earned a file because navigating a crossword is a subject in itself; a kakuro
 * run is a list of squares the document already carries, so indexing it is four lines.
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
     * The two runs crossing the cursor, which is what a solver is reading.
     *
     * Not the row and the column, which is the base element's default and would be wrong here: a
     * kakuro row is several runs with nothing to do with each other, so washing the whole row would
     * highlight squares whose sums the player is not working on. This is the same argument as
     * crossword's entry highlight, in a puzzle where the cursor lies on two entries at once.
     */
    isHighlighted(idx) {
        if (this.selection == null) return false;
        return (this.#runsOf[this.selection] ?? []).some((run) => run.cells.includes(idx));
    }

    /**
     * Arrow keys skip the clue squares rather than stopping at them.
     *
     * Crossword's rule without the direction half: a kakuro cursor points nowhere in particular, it
     * is simply somewhere, so an arrow always moves and never turns. Stopping dead at a clue square
     * would strand the cursor mid-grid, since a kakuro's blocked squares run through the middle of
     * the puzzle rather than around its edge.
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
