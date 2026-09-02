/**
 * Bitmask suguru solver, used for filling a region partition and for the uniqueness proof.
 *
 * Grids are flat Uint8Arrays of length n * n holding 1..(a cell's own region size), with 0 for
 * empty. Unlike sudoku's row/column/box units, a suguru cell's constraints come from two different
 * shapes at once: every other cell in its own region, and every cell touching it on the grid,
 * orthogonally or diagonally (ADR-0019). Both are folded into one *peer* list per cell, which is
 * what lets the search below read exactly like sudoku's: assign a value, strike it from every
 * peer's candidates, recurse on whichever open cell has the fewest left.
 *
 * A region's own domain, 1..its size, is what makes region membership enough on its own: since a
 * region of size k can only ever hold the k values its cells' shared domain admits, striking a
 * placed value from every region-mate's candidates is exactly the constraint "a permutation of
 * 1..k", with no separate rule needed to say so.
 */

/** Counts the set bits in a candidate mask. */
function popCount(mask) {
    let count = 0;
    for (let bits = mask; bits !== 0; bits &= bits - 1) count += 1;
    return count;
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
 * Every cell's region size and its peers: its region-mates, plus its up-to-eight grid neighbours.
 *
 * Built once per partition and reused by generation, uniqueness checking, and rate.js, since all
 * three ask the same question of the same fixed regions.
 *
 * @param {{ id: number, cells: number[] }[]} regions - The puzzle's regions.
 * @param {number} n - Grid side length.
 * @returns {{ peers: number[][], sizeOf: Uint8Array }} Peer list and region size, per cell.
 */
export function buildPeers(regions, n) {
    const total = n * n;
    const sizeOf = new Uint8Array(total);
    const regionOf = new Int32Array(total);
    regions.forEach((region) => {
        for (const cell of region.cells) {
            sizeOf[cell] = region.cells.length;
            regionOf[cell] = region.id;
        }
    });

    const peers = new Array(total);
    for (let idx = 0; idx < total; idx += 1) {
        const row = Math.floor(idx / n);
        const col = idx % n;
        const set = new Set();

        for (const cell of regions[regionOf[idx]].cells) {
            if (cell !== idx) set.add(cell);
        }
        for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= n || c < 0 || c >= n) continue;
                set.add(r * n + c);
            }
        }

        peers[idx] = [...set];
    }

    return { peers, sizeOf };
}

/** The initial candidate mask per cell, from region size alone, narrowed by any given values. */
function initialCandidates(cells, peers, sizeOf) {
    const candidates = new Int32Array(cells.length);
    for (let idx = 0; idx < cells.length; idx += 1) {
        candidates[idx] = cells[idx] === 0 ? (1 << sizeOf[idx]) - 1 : 0;
    }
    for (let idx = 0; idx < cells.length; idx += 1) {
        if (cells[idx] === 0) continue;
        const bit = 1 << (cells[idx] - 1);
        for (const peer of peers[idx]) candidates[peer] &= ~bit;
    }
    return candidates;
}

/**
 * How many search nodes a single call may visit before it gives up on the question.
 *
 * Proving *no* solution exists, or that a partial grid has only one, means exhausting a branch
 * rather than stopping at the first success, and an under-constrained or badly-shaped partition can
 * make that branch enormous: an early measurement without this cap saw a single call run for over
 * three minutes. Bounded the way kakuro's own counting search is bounded (solver.js NODE_BUDGET),
 * for the same reason: the generator's outer retry loop is what is supposed to govern wall time, and
 * it cannot if one inner call refuses to return.
 */
const NODE_BUDGET = 100_000;

/**
 * Recursive search over the grid. Picks the empty cell with the fewest candidates first, the same
 * ordering sudoku's solver uses and for the same reason: it fails fast and finds a first solution
 * fast.
 *
 * Returns the number of solutions found, stopping once limit is reached or the node budget runs out;
 * found.cut is set in the latter case, since a cut search has proved nothing about the cells left
 * unexplored.
 */
function search(cells, peers, candidates, limit, order, found) {
    found.nodes += 1;
    if (found.nodes > NODE_BUDGET) {
        found.cut = true;
        return found.count;
    }

    let bestIdx = -1;
    let bestMask = 0;
    let bestCount = 99;

    for (let idx = 0; idx < cells.length; idx += 1) {
        if (cells[idx] !== 0) continue;
        const count = popCount(candidates[idx]);
        if (count === 0) return found.count;
        if (count < bestCount) {
            bestIdx = idx;
            bestMask = candidates[idx];
            bestCount = count;
            if (count === 1) break;
        }
    }

    if (bestIdx === -1) {
        found.count += 1;
        if (found.first === null) found.first = Uint8Array.from(cells);
        return found.count;
    }

    const values = order ? order(bestMask) : maskValues(bestMask);

    for (const value of values) {
        const bit = 1 << (value - 1);
        cells[bestIdx] = value;

        const narrowed = [];
        for (const peer of peers[bestIdx]) {
            if (cells[peer] === 0 && candidates[peer] & bit) {
                candidates[peer] &= ~bit;
                narrowed.push(peer);
            }
        }

        search(cells, peers, candidates, limit, order, found);

        cells[bestIdx] = 0;
        for (const peer of narrowed) candidates[peer] |= bit;

        if (found.count >= limit || found.cut) break;
    }

    return found.count;
}

/**
 * Counts how many ways a partially or fully filled grid can be completed, stopping early once
 * limit is hit.
 *
 * **complete is not the same as count === 1.** A cut search has found whatever it found and proved
 * nothing about the rest of the tree, so one solution with complete false means "could not tell
 * within budget", never "unique". The generator's dig loop reads both: a dig is kept only when the
 * search both completed and found exactly one.
 *
 * @param {Uint8Array} cells - Grid with 0 for empty cells; not mutated.
 * @param {{ id: number, cells: number[] }[]} regions - The puzzle's regions.
 * @param {number} n - Grid side length.
 * @param {number} [limit] - Stop counting at this many solutions. Defaults to 2.
 * @returns {{ count: number, complete: boolean }} Solution count, capped at limit, and whether the
 *   search exhausted the tree rather than running out of budget.
 */
export function countSolutions(cells, regions, n, limit = 2) {
    const { peers, sizeOf } = buildPeers(regions, n);
    const working = Uint8Array.from(cells);
    const candidates = initialCandidates(working, peers, sizeOf);
    const found = { count: 0, first: null, nodes: 0, cut: false };
    const count = search(working, peers, candidates, limit, null, found);
    return { count, complete: !found.cut };
}

/**
 * Produces a random full grid over a fixed region partition, respecting region and adjacency
 * constraints, by solving an empty grid with the candidate order shuffled.
 *
 * @param {{ id: number, cells: number[] }[]} regions - The puzzle's regions.
 * @param {number} n - Grid side length.
 * @param {import('../rng.js').Rng} rng - Seeded generator; the only source of randomness.
 * @returns {Uint8Array} A valid, fully populated grid.
 * @throws {Error} If no solution is found within the node budget, whether because the partition is
 *   truly unfillable or because proving one either way turned out to be too expensive to wait for.
 */
export function randomFilledGrid(regions, n, rng) {
    const { peers, sizeOf } = buildPeers(regions, n);
    const cells = new Uint8Array(n * n);
    const candidates = initialCandidates(cells, peers, sizeOf);
    const found = { count: 0, first: null, nodes: 0, cut: false };
    search(cells, peers, candidates, 1, (mask) => rng.shuffle(maskValues(mask)), found);
    if (!found.first) throw new Error('solver failed to fill an empty region partition');
    return found.first;
}
