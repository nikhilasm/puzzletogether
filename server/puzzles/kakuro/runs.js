/**
 * A kakuro layout's runs: the maximal straight lines of open squares that each clue is written for.
 *
 * Everything else about kakuro is derived from these. The fill has to keep a run's digits distinct,
 * the sums are read off them, the solver constrains them, and the client highlights them, so this
 * file is the one place the geometry is worked out and every other file takes it as given.
 *
 * **A kakuro grid is not symmetric, unlike a crossword's.** Its clue border runs along the top and
 * left only, so a 180° rotation would map the border onto the last row and column, where a kakuro
 * has ordinary squares. There is nothing to preserve, which is what lets the layout be drawn by
 * placing blocks one at a time and keeping whichever ones leave a legal grid.
 */

/** Reading directions, as they travel in the document's meta. */
export const ACROSS = 'A';
export const DOWN = 'D';

/**
 * Shortest run a layout may contain.
 *
 * A run of one square is a clue that names its own digit, which is a given wearing a sum's clothes.
 * Kakuro conventionally has none, and allowing them here would let the layout drawer relieve its own
 * difficulty in a way nothing downstream could see.
 */
export const MIN_RUN = 2;

/** Longest run: nine distinct digits, so a tenth square could not be filled at all. */
export const MAX_RUN = 9;

/** Collects one run, unless the squares scanned were a gap rather than a line. */
function pushRun(runs, dir, cells) {
    if (cells.length === 0) return;
    runs.push({ id: runs.length, dir, cells, sum: 0 });
}

/**
 * Every run in a layout, across runs first, each carrying its squares in reading order.
 *
 * Sums come back zero: they are a property of the filled grid rather than of the layout, and
 * generation writes them once it has one.
 *
 * @param {Uint8Array} white - One entry per cell, 1 for an open square and 0 for a block.
 * @param {number} n - Grid side length.
 * @returns {{ id: number, dir: string, cells: number[], sum: number }[]} The layout's runs.
 */
export function deriveRuns(white, n) {
    const runs = [];

    for (let row = 0; row < n; row += 1) {
        let cells = [];
        for (let col = 0; col < n; col += 1) {
            const idx = row * n + col;
            if (white[idx]) cells.push(idx);
            else {
                pushRun(runs, ACROSS, cells);
                cells = [];
            }
        }
        pushRun(runs, ACROSS, cells);
    }

    for (let col = 0; col < n; col += 1) {
        let cells = [];
        for (let row = 0; row < n; row += 1) {
            const idx = row * n + col;
            if (white[idx]) cells.push(idx);
            else {
                pushRun(runs, DOWN, cells);
                cells = [];
            }
        }
        pushRun(runs, DOWN, cells);
    }

    return runs;
}

/**
 * The across and down run each open square belongs to, which is what the fill and the client both
 * ask for one square at a time.
 *
 * Every open square in a legal layout has exactly one of each, since a run is a maximal line and
 * a square lies on one horizontal and one vertical.
 *
 * @param {object[]} runs - The layout's runs, from deriveRuns.
 * @param {number} total - Cell count, so the index covers the whole grid.
 * @returns {({ across: object, down: object }|null)[]} One entry per cell, null at a block.
 */
export function indexRuns(runs, total) {
    const index = new Array(total).fill(null);

    for (const run of runs) {
        for (const cell of run.cells) {
            const entry = index[cell] ?? { across: null, down: null };
            if (run.dir === ACROSS) entry.across = run;
            else entry.down = run;
            index[cell] = entry;
        }
    }

    return index;
}

/**
 * The square a run's sum is printed on: the block immediately before its first cell.
 *
 * Always exists, because row 0 and column 0 are blocks in every layout this module draws, so no run
 * can start against the grid's edge.
 *
 * @param {{ dir: string, cells: number[] }} run - The run.
 * @param {number} n - Grid side length.
 * @returns {number} Flat index of the square the clue is written on.
 */
export function clueSquare(run, n) {
    return run.dir === ACROSS ? run.cells[0] - 1 : run.cells[0] - n;
}

/**
 * Whether a layout has no run shorter than MIN_RUN, which is the invariant the layout drawer has to
 * preserve with every block it places.
 *
 * Runs that are too *long* are not checked here: the drawer creates them and then splits them, so
 * they are a stage rather than a fault.
 *
 * @param {Uint8Array} white - One entry per cell, 1 for an open square.
 * @param {number} n - Grid side length.
 * @returns {boolean} True when every run is at least MIN_RUN squares long.
 */
export function hasNoShortRun(white, n) {
    return deriveRuns(white, n).every((run) => run.cells.length >= MIN_RUN);
}
