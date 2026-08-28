/**
 * Entry numbering: which squares carry a number, and which squares each entry runs through.
 *
 * A crossword's numbering is not authored, it is *implied* by where the black squares are, which
 * means it can be derived and therefore checked. This module is written once and
 * used in both directions (design-spec.md §8): scripts/import-crossword.js calls it to build a
 * bank file, and the bank loader calls it again at boot to confirm the file still agrees with its
 * own grid. A stored entry list that nothing verifies would only be a second place to be wrong.
 *
 * Pure and file-free, so both callers and the tests can use it without touching a disk.
 */

/**
 * @typedef {import('../../../shared/protocol.js').GridSize} GridSize
 * @typedef {{ num: number, dir: 'A'|'D', cells: number[], len: number }} Entry
 */

/**
 * Whether a square begins a word in a direction: the rule every crossword is numbered by.
 *
 * A square starts an entry when nothing precedes it in that direction (the grid edge or a black
 * square) and something follows it. Both halves matter: without the first, every square in a word
 * would be numbered; without the second, a lone square wedged between two blocks would be numbered
 * as an entry of length one, which is not a word and has no clue.
 *
 * @param {boolean[]} blocks - One entry per cell, true where the square is black.
 * @param {GridSize} size - Grid dimensions.
 * @param {number} row - Zero-based row.
 * @param {number} col - Zero-based column.
 * @param {'A'|'D'} dir - Across or Down.
 * @returns {boolean} True when an entry starts here.
 */
function startsEntry(blocks, size, row, col, dir) {
    const [stepRow, stepCol] = dir === 'A' ? [0, 1] : [1, 0];
    const open = (r, c) =>
        r >= 0 && r < size.rows && c >= 0 && c < size.cols && !blocks[r * size.cols + c];

    return (
        open(row, col) && !open(row - stepRow, col - stepCol) && open(row + stepRow, col + stepCol)
    );
}

/**
 * Every cell an entry runs through, from its first square to the black square or edge that ends it.
 *
 * @param {boolean[]} blocks - One entry per cell, true where the square is black.
 * @param {GridSize} size - Grid dimensions.
 * @param {number} row - Starting row.
 * @param {number} col - Starting column.
 * @param {'A'|'D'} dir - Across or Down.
 * @returns {number[]} Flat cell indices in reading order.
 */
function runFrom(blocks, size, row, col, dir) {
    const [stepRow, stepCol] = dir === 'A' ? [0, 1] : [1, 0];
    const cells = [];

    for (let r = row, c = col; r < size.rows && c < size.cols; r += stepRow, c += stepCol) {
        const idx = r * size.cols + c;
        if (blocks[idx]) break;
        cells.push(idx);
    }
    return cells;
}

/**
 * Numbers a grid and lists its entries.
 *
 * Entries come back ordered by number, Across before Down at the same number. That is not a
 * cosmetic choice: it is exactly the order .puz stores its clue list in, so the importer can pair
 * clues to entries by walking the two lists together rather than by looking anything up.
 *
 * @param {boolean[]} blocks - One entry per cell, row-major, true where the square is black.
 * @param {GridSize} size - Grid dimensions.
 * @returns {{ labels: (string|null)[], entries: Entry[] }} The number drawn in each square, and
 *   every entry in clue order.
 * @throws {RangeError} If blocks does not describe exactly this grid.
 */
export function numberGrid(blocks, size) {
    const total = size.rows * size.cols;
    if (blocks.length !== total) {
        throw new RangeError(`expected ${total} cells for ${size.rows}x${size.cols}`);
    }

    const labels = new Array(total).fill(null);
    const entries = [];
    let num = 0;

    for (let row = 0; row < size.rows; row += 1) {
        for (let col = 0; col < size.cols; col += 1) {
            const across = startsEntry(blocks, size, row, col, 'A');
            const down = startsEntry(blocks, size, row, col, 'D');
            if (!across && !down) continue;

            num += 1;
            labels[row * size.cols + col] = String(num);
            // Across first at the same number, which is how clue lists are ordered.
            if (across) {
                const cells = runFrom(blocks, size, row, col, 'A');
                entries.push({ num, dir: 'A', cells, len: cells.length });
            }
            if (down) {
                const cells = runFrom(blocks, size, row, col, 'D');
                entries.push({ num, dir: 'D', cells, len: cells.length });
            }
        }
    }

    return { labels, entries };
}

/**
 * Re-derives a document's numbering and reports the first way it disagrees with what is stored.
 *
 * This is the boot-time half of writing the numbering once. The importer computed these entries; a
 * hand-edited file, a hand-authored mini, or a bad merge can leave them describing a grid that is no
 * longer there, and an entry pointing at the wrong squares is not a crash but a puzzle that
 * highlights the wrong row and cannot be solved. Cheaper to refuse the file at boot.
 *
 * Clue text is deliberately not checked. Whether a clue is *good* is not a question a computer gets
 * to have an opinion on; whether one is *present* is, and that is the count check.
 *
 * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - A loaded crossword document.
 * @returns {string|null} The disagreement, or null when the document numbers itself correctly.
 */
export function checkNumbering(doc) {
    const blocks = doc.cells.map((cell) => cell.block === true);
    const { labels, entries } = numberGrid(blocks, doc.size);
    const stored = doc.meta?.entries ?? [];

    if (stored.length !== entries.length) {
        return `grid implies ${entries.length} entries, document lists ${stored.length}`;
    }

    for (let i = 0; i < entries.length; i += 1) {
        const want = entries[i];
        const got = stored[i];
        const name = `${want.num}${want.dir}`;
        if (got.num !== want.num || got.dir !== want.dir) {
            return `entry ${i} should be ${name}, document says ${got.num}${got.dir}`;
        }
        if (got.cells?.join(',') !== want.cells.join(',')) {
            return `entry ${name} should cover cells ${want.cells.join(',')}`;
        }
        if (got.len !== want.len) {
            return `entry ${name} should be ${want.len} long, document says ${got.len}`;
        }
        if (typeof got.clue !== 'string' || got.clue.length === 0) {
            return `entry ${name} has no clue`;
        }
    }

    for (let idx = 0; idx < labels.length; idx += 1) {
        if ((doc.cells[idx].label ?? null) !== labels[idx]) {
            return `cell ${idx} should be labelled ${labels[idx] ?? 'nothing'}`;
        }
    }

    return null;
}
