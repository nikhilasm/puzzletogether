/**
 * Bitmask sudoku solver, used for both generation and the uniqueness proof; grids are flat
 * Uint8Arrays of n * n holding 1..n, with 0 for empty. Everything here is a hot path: plain loops,
 * no allocation inside the recursion (code-style.md §7).
 */

/**
 * @typedef {object} Dims
 * @property {number} n - Grid side length, and the number of distinct values.
 * @property {number} regionRows - Region height in cells.
 * @property {number} regionCols - Region width in cells.
 * @property {Uint8Array} boxOf - Region index for each cell.
 * @property {number} full - Bitmask with the low n bits set.
 */

/** Region shape for each supported grid size. */
const REGION_SHAPES = {
    4: { regionRows: 2, regionCols: 2 },
    6: { regionRows: 2, regionCols: 3 },
    9: { regionRows: 3, regionCols: 3 },
};

/**
 * Builds the derived dimensions a solver needs for an n × n grid.
 *
 * @param {number} n - Grid side length; must be a supported sudoku size.
 * @returns {Dims} Region shape, per-cell region lookup, and the full candidate mask.
 * @throws {RangeError} If n is not a supported size.
 */
export function createDims(n) {
    const shape = REGION_SHAPES[n];
    if (!shape) throw new RangeError(`unsupported sudoku size: ${n}`);

    const boxOf = new Uint8Array(n * n);
    for (let idx = 0; idx < n * n; idx += 1) {
        const row = Math.floor(idx / n);
        const col = idx % n;
        boxOf[idx] =
            Math.floor(row / shape.regionRows) * (n / shape.regionCols) +
            Math.floor(col / shape.regionCols);
    }

    return { n, ...shape, boxOf, full: (1 << n) - 1 };
}

/** Builds row, column, and region occupancy masks for a grid as it currently stands. */
function buildMasks(cells, dims) {
    const { n, boxOf } = dims;
    const rows = new Int32Array(n);
    const cols = new Int32Array(n);
    const boxes = new Int32Array(n);

    for (let idx = 0; idx < cells.length; idx += 1) {
        const value = cells[idx];
        if (value === 0) continue;
        const bit = 1 << (value - 1);
        rows[Math.floor(idx / n)] |= bit;
        cols[idx % n] |= bit;
        boxes[boxOf[idx]] |= bit;
    }

    return { rows, cols, boxes };
}

/**
 * Recursive search over the grid, picking the empty cell with the fewest candidates first to keep
 * generation and uniqueness checking fast enough to run per dig. Returns the number of solutions
 * found, stopping once limit is reached.
 */
function search(cells, dims, masks, limit, order, found) {
    const { n, boxOf, full } = dims;

    let bestIdx = -1;
    let bestMask = 0;
    let bestCount = n + 1;

    for (let idx = 0; idx < cells.length; idx += 1) {
        if (cells[idx] !== 0) continue;
        const used =
            masks.rows[Math.floor(idx / n)] | masks.cols[idx % n] | masks.boxes[boxOf[idx]];
        const candidates = full & ~used;
        if (candidates === 0) return found.count;

        let count = 0;
        for (let mask = candidates; mask !== 0; mask &= mask - 1) count += 1;
        if (count < bestCount) {
            bestIdx = idx;
            bestMask = candidates;
            bestCount = count;
            if (count === 1) break;
        }
    }

    if (bestIdx === -1) {
        // No empty cells left: the grid is a complete solution.
        found.count += 1;
        if (found.first === null) found.first = Uint8Array.from(cells);
        return found.count;
    }

    const row = Math.floor(bestIdx / n);
    const col = bestIdx % n;
    const box = boxOf[bestIdx];
    const values = order ? order(bestMask) : maskValues(bestMask);

    for (const value of values) {
        const bit = 1 << (value - 1);
        cells[bestIdx] = value;
        masks.rows[row] |= bit;
        masks.cols[col] |= bit;
        masks.boxes[box] |= bit;

        search(cells, dims, masks, limit, order, found);

        cells[bestIdx] = 0;
        masks.rows[row] &= ~bit;
        masks.cols[col] &= ~bit;
        masks.boxes[box] &= ~bit;

        if (found.count >= limit) break;
    }

    return found.count;
}

/** Expands a candidate bitmask into the list of values it allows. */
function maskValues(mask) {
    const values = [];
    for (let bit = 0; mask !== 0; bit += 1, mask >>= 1) {
        if (mask & 1) values.push(bit + 1);
    }
    return values;
}

/**
 * Counts how many ways a grid can be completed, stopping early once limit is hit.
 *
 * Uniqueness is proved by calling this with limit = 2; the whole generator rests on it.
 *
 * @param {Uint8Array} cells - Grid with 0 for empty cells; restored before returning.
 * @param {Dims} dims - Dimensions from createDims.
 * @param {number} [limit] - Stop counting at this many solutions. Defaults to 2.
 * @returns {number} Solution count, capped at limit.
 */
export function countSolutions(cells, dims, limit = 2) {
    const working = Uint8Array.from(cells);
    const found = { count: 0, first: null };
    return search(working, dims, buildMasks(working, dims), limit, null, found);
}

/**
 * Solves a grid, returning the first solution found.
 *
 * @param {Uint8Array} cells - Grid with 0 for empty cells; not mutated.
 * @param {Dims} dims - Dimensions from createDims.
 * @returns {Uint8Array|null} The completed grid, or null if it cannot be solved.
 */
export function solveFirst(cells, dims) {
    const working = Uint8Array.from(cells);
    const found = { count: 0, first: null };
    search(working, dims, buildMasks(working, dims), 1, null, found);
    return found.first;
}

/**
 * Produces a random completed grid by solving an empty one with the candidate order shuffled.
 *
 * @param {Dims} dims - Dimensions from createDims.
 * @param {import('../rng.js').Rng} rng - Seeded generator; the only source of randomness.
 * @returns {Uint8Array} A valid, fully populated grid.
 * @throws {Error} If no solution is found, which would mean the solver is broken.
 */
export function randomSolvedGrid(dims, rng) {
    const cells = new Uint8Array(dims.n * dims.n);
    const found = { count: 0, first: null };
    search(cells, dims, buildMasks(cells, dims), 1, (mask) => rng.shuffle(maskValues(mask)), found);
    if (!found.first) throw new Error('solver failed to fill an empty grid');
    return found.first;
}
