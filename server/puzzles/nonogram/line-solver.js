/**
 * The nonogram line-solver: the one piece of logic that decides both whether a puzzle is fair and
 * how hard it is, the uniqueness proof since a puzzle it cannot finish would have to be guessed
 * (ADR-0004). It is also the measurement, since how many sweeps it took is a property of the puzzle,
 * letting nonogram label a measured difficulty like sudoku.
 */

/** Cell states inside the solver. Kept numeric so a line is a Uint8Array. */
export const UNKNOWN = 0;
export const FILL = 1;
export const CROSS = 2;

/**
 * Narrows one line as far as its clues allow, given what is already known. Works by enumerating
 * every consistent block placement and keeping only what all agree on, leaving the rest unknown.
 *
 * @param {number[]} clues - Block lengths for this line, in order.
 * @param {Uint8Array} line - Known state per cell.
 * @returns {Uint8Array|null} The narrowed line, or null when no placement fits at all.
 */
export function solveLine(clues, line) {
    const length = line.length;
    // An empty line is clued [0], which is a statement about the line rather than a block to place.
    const blocks = clues.filter((clue) => clue > 0);
    const filledIn = new Int32Array(length);
    const crossedIn = new Int32Array(length);
    const candidate = new Uint8Array(length);
    let placements = 0;

    // start is the first cell this clue may occupy; everything before it is already decided.
    const place = (clueIdx, start) => {
        if (clueIdx === blocks.length) {
            for (let i = start; i < length; i += 1) {
                if (line[i] === FILL) return;
                candidate[i] = CROSS;
            }

            placements += 1;
            for (let i = 0; i < length; i += 1) {
                if (candidate[i] === FILL) filledIn[i] += 1;
                else crossedIn[i] += 1;
            }
            return;
        }

        const block = blocks[clueIdx];
        let tail = 0;
        for (let i = clueIdx + 1; i < blocks.length; i += 1) tail += blocks[i] + 1;
        const lastStart = length - tail - block;

        for (let at = start; at <= lastStart; at += 1) {
            // A known fill in the gap cannot be left empty, and no later start covers it either.
            if (at > start && line[at - 1] === FILL) break;

            let fits = true;
            for (let i = at; i < at + block && fits; i += 1) {
                if (line[i] === CROSS) fits = false;
            }
            // The block has to end where it ends, so the cell after it must not be a known fill.
            if (fits && at + block < length && line[at + block] === FILL) fits = false;
            if (!fits) continue;

            for (let i = start; i < at; i += 1) candidate[i] = CROSS;
            for (let i = at; i < at + block; i += 1) candidate[i] = FILL;
            if (at + block < length) candidate[at + block] = CROSS;

            place(clueIdx + 1, at + block + 1);
        }
    };

    place(0, 0);
    if (placements === 0) return null;

    const result = line.slice();
    for (let i = 0; i < length; i += 1) {
        if (filledIn[i] === placements) result[i] = FILL;
        else if (crossedIn[i] === placements) result[i] = CROSS;
    }
    return result;
}

/** Reads one row or column out of the grid into a line buffer. */
function readLine(grid, rows, cols, index, isRow) {
    const length = isRow ? cols : rows;
    const line = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
        line[i] = grid[isRow ? index * cols + i : i * cols + index];
    }
    return line;
}

/** Writes a narrowed line back, reporting whether it actually told us anything new. */
function writeLine(grid, rows, cols, index, isRow, line) {
    const length = isRow ? cols : rows;
    let changed = false;

    for (let i = 0; i < length; i += 1) {
        const at = isRow ? index * cols + i : i * cols + index;
        if (grid[at] === line[i]) continue;
        grid[at] = line[i];
        changed = true;
    }

    return changed;
}

/**
 * Solves a nonogram from its clues alone, by sweeping every row and column until nothing changes.
 *
 * @param {number[][]} rowClues - Block lengths per row.
 * @param {number[][]} colClues - Block lengths per column.
 * @param {number} rows - Row count.
 * @param {number} cols - Column count.
 * @returns {{ grid: Uint8Array, solved: boolean, sweeps: number }|null} The furthest the solver got,
 *   how many sweeps deduced something (the final no-op sweep is not counted), and whether it
 *   finished; null when the clues contradict each other.
 */
export function lineSolve(rowClues, colClues, rows, cols) {
    const grid = new Uint8Array(rows * cols).fill(UNKNOWN);
    let sweeps = -1;

    for (let changed = true; changed; sweeps += 1) {
        changed = false;

        for (let row = 0; row < rows; row += 1) {
            const line = solveLine(rowClues[row], readLine(grid, rows, cols, row, true));
            if (!line) return null;
            if (writeLine(grid, rows, cols, row, true, line)) changed = true;
        }

        for (let col = 0; col < cols; col += 1) {
            const line = solveLine(colClues[col], readLine(grid, rows, cols, col, false));
            if (!line) return null;
            if (writeLine(grid, rows, cols, col, false, line)) changed = true;
        }
    }

    return { grid, solved: !grid.includes(UNKNOWN), sweeps };
}

/**
 * The clue list for one line of a bitmap: the length of each run of filled cells.
 *
 * An empty line's clue is [0] rather than [], because the gutter has to draw something; a blank
 * clue reads as "not yet worked out" where a 0 reads as "this line is empty".
 *
 * @param {number[]} cells - One row or column, 1 for filled.
 * @returns {number[]} Block lengths in order.
 */
export function cluesFor(cells) {
    const clues = [];
    let run = 0;

    for (const cell of cells) {
        if (cell) {
            run += 1;
        } else if (run > 0) {
            clues.push(run);
            run = 0;
        }
    }
    if (run > 0) clues.push(run);

    return clues.length > 0 ? clues : [0];
}
