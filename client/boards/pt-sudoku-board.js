/**
 * The sudoku grid: region borders and digit input.
 *
 * Everything else — cell DOM, selection, presence, op emission — comes from `<pt-board>`. This is
 * the whole client-side cost of a puzzle type.
 */

import { PtBoard } from './pt-board.js';

export class PtSudokuBoard extends PtBoard {
    /** Region boundaries get the heavy line, except at the right edge where the frame draws it. */
    isHeavyRight(idx) {
        const { regionCols } = this.doc.meta;
        const col = idx % this.doc.size.cols;
        return (col + 1) % regionCols === 0 && col + 1 < this.doc.size.cols;
    }

    /** As `isHeavyRight`, for the bottom edge of a region. */
    isHeavyBottom(idx) {
        const { regionRows } = this.doc.meta;
        const row = Math.floor(idx / this.doc.size.cols);
        return (row + 1) % regionRows === 0 && row + 1 < this.doc.size.rows;
    }

    /** Accepts only digits in this puzzle's alphabet, so a 4×4 never takes a 7. */
    valueForKey(key) {
        return this.doc.meta.alphabet.includes(key) ? key : null;
    }
}

customElements.define('pt-sudoku-board', PtSudokuBoard);
