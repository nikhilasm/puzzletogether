/**
 * Where a kakuro's blocks go: a symmetric, clustered pattern at a difficulty's density (ADR-0016).
 * The symmetry is of the interior (rows and columns 1 to n-1), never the clue border, which is what
 * keeps clueSquare in range on the promise that row 0 and column 0 are entirely blocked.
 */

import { deriveRuns, hasNoShortRun, MAX_RUN, MIN_RUN } from './runs.js';

/**
 * How often a block extends a clump rather than starting a new one. Three in four leaves roughly a
 * quarter of the pairs as fresh seeds; at 0 the pattern is a scatter, and at 1 the whole budget grows
 * off one square, walling off a corner and leaving every other run at full length.
 */
const CLUSTER_BIAS = 0.75;

/**
 * The square an interior square is paired with, under a 180 degree turn about the interior's centre.
 * No square is ever its own partner (the interior side is even), so placement treats every orbit as a
 * pair with no special case, and a layout's block count is always even.
 *
 * @param {number} idx - Flat index of an interior square.
 * @param {number} n - Grid side length.
 * @returns {number} Flat index of its partner, itself an interior square.
 */
export function partnerOf(idx, n) {
    return (n - Math.floor(idx / n)) * n + (n - (idx % n));
}

/** A grid with its clue border blocked and everything inside it open. */
function openInterior(n) {
    const white = new Uint8Array(n * n);
    for (let row = 1; row < n; row += 1) {
        for (let col = 1; col < n; col += 1) white[row * n + col] = 1;
    }
    return white;
}

/** Every symmetric pair of interior squares, each listed once. */
function orbitsOf(n) {
    const orbits = [];
    const seen = new Uint8Array(n * n);

    for (let row = 1; row < n; row += 1) {
        for (let col = 1; col < n; col += 1) {
            const idx = row * n + col;
            if (seen[idx]) continue;
            const partner = partnerOf(idx, n);
            seen[idx] = 1;
            seen[partner] = 1;
            orbits.push([idx, partner]);
        }
    }

    return orbits;
}

/**
 * Whether the open squares are still one connected region. A mirrored pair at a quarter density
 * readily walls a grid off, and a walled-off region is a second puzzle sharing the page; exported
 * because repair blocks squares too, and a grid it walls off is as wrong as one drawn that way.
 *
 * @param {Uint8Array} white - One entry per cell, 1 for an open square.
 * @param {number} n - Grid side length.
 * @returns {boolean} True when every open square is reachable from every other.
 */
export function isConnected(white, n) {
    const start = white.indexOf(1);
    if (start < 0) return false;

    const seen = new Uint8Array(white.length);
    const stack = [start];
    seen[start] = 1;
    let reached = 0;

    while (stack.length > 0) {
        const idx = stack.pop();
        reached += 1;
        const row = Math.floor(idx / n);
        const col = idx % n;

        for (const [dr, dc] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ]) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= n || c < 0 || c >= n) continue;
            const next = r * n + c;
            if (!white[next] || seen[next]) continue;
            seen[next] = 1;
            stack.push(next);
        }
    }

    let open = 0;
    for (const square of white) open += square;
    return reached === open;
}

/** Whether a square touches a block that placement put there, rather than one the border started with. */
function touchesBlock(idx, white, n) {
    const row = Math.floor(idx / n);
    const col = idx % n;

    for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]) {
        const r = row + dr;
        const c = col + dc;
        if (r < 1 || r >= n || c < 1 || c >= n) continue;
        if (!white[r * n + c]) return true;
    }

    return false;
}

/**
 * Picks which pair to place next, from what is left. A cascade rather than a score, since the three
 * rules are not comparable; clustering counts only blocks placed here, not the border, so clumps grow
 * in the interior rather than chewing a staircase along the frame.
 */
function pickOrbit(remaining, white, n, longCells, rng) {
    if (longCells) {
        const splits = remaining.findIndex(([idx, partner]) => {
            return longCells.has(idx) || longCells.has(partner);
        });
        if (splits >= 0) return splits;
    }

    if (rng.next() < CLUSTER_BIAS) {
        const beside = remaining.findIndex(([idx]) => touchesBlock(idx, white, n));
        if (beside >= 0) return beside;
    }

    return remaining.length > 0 ? 0 : -1;
}

/** The squares sitting in a run that is longer than the layout allows. */
function cellsInLongRuns(white, n, limit) {
    const cells = new Set();
    for (const run of deriveRuns(white, n)) {
        if (run.cells.length <= limit) continue;
        for (const cell of run.cells) cells.add(cell);
    }
    return cells.size > 0 ? cells : null;
}

/**
 * Places symmetric pairs until the grid is dense enough and no run is too long. A pair that leaves a
 * run of one square or splits the open squares is refused and dropped rather than retried, since
 * blocks are only ever added, which bounds the loop at one pass over the pairs.
 */
function placePairs(white, n, target, limit, rng) {
    const remaining = rng.shuffle(orbitsOf(n));
    let placed = 0;

    while (remaining.length > 0) {
        const longCells = cellsInLongRuns(white, n, limit);
        if (!longCells && placed >= target) break;

        const at = pickOrbit(remaining, white, n, longCells, rng);
        if (at < 0) break;
        const [idx, partner] = remaining.splice(at, 1)[0];

        white[idx] = 0;
        white[partner] = 0;
        if (hasNoShortRun(white, n) && isConnected(white, n)) {
            placed += 2;
            continue;
        }
        white[idx] = 1;
        white[partner] = 1;
    }

    return placed;
}

/** Where a run may be cut so that what is left of it on either side is a legal run, or nothing. */
export function splitPoints(run) {
    const length = run.cells.length;
    const points = [];

    for (let at = 0; at < length; at += 1) {
        const before = at;
        const after = length - 1 - at;
        if (before !== 0 && before < MIN_RUN) continue;
        if (after !== 0 && after < MIN_RUN) continue;
        points.push(run.cells[at]);
    }

    return points;
}

/** Whether every run is short enough to be filled at all, whatever the difficulty asked for. */
export function withinLaw(white, n) {
    return deriveRuns(white, n).every((run) => run.cells.length <= MAX_RUN);
}

/**
 * Cuts any run the symmetric pass could not shorten, one block at a time. The safety net and the one
 * place a layout loses its symmetry: a grid with one odd block is better than a grid with a run of
 * eleven, so the fault is preferred to the failure.
 */
function subdivide(white, n, limit, rng) {
    for (let guard = 0; guard < n * n; guard += 1) {
        const long = deriveRuns(white, n).filter((run) => run.cells.length > limit);
        if (long.length === 0) return true;

        // Every long run and every split point in it, since blocking a square shortens its other run
        // too and late in a layout most positions leave a run of one somewhere across the grid.
        let split = false;
        for (const run of rng.shuffle([...long])) {
            for (const cell of rng.shuffle(splitPoints(run))) {
                white[cell] = 0;
                if (hasNoShortRun(white, n) && isConnected(white, n)) {
                    split = true;
                    break;
                }
                white[cell] = 1;
            }
            if (split) break;
        }

        // The limit is what the layout would like; MAX_RUN is what a run of distinct digits can
        // physically hold. When nothing more can be cut, the layout is still good if it is legal.
        if (!split) return withinLaw(white, n);
    }

    return withinLaw(white, n);
}

/**
 * Draws a layout: the clue border, then a symmetric clustered block pattern at the density asked
 * for.
 *
 * @param {number} n - Grid side length, counting the clue border.
 * @param {object} options - What the layout should come out like.
 * @param {number} options.density - Share of interior squares to block, as a fraction.
 * @param {number} options.limit - Longest run the layout may keep.
 * @param {import('../rng.js').Rng} options.rng - Seeded generator.
 * @returns {Uint8Array|null} One entry per cell, 1 for an open square, or null if no legal layout
 *   came out of this draw.
 */
export function drawLayout(n, { density, limit, rng }) {
    const white = openInterior(n);
    const interior = (n - 1) * (n - 1);

    placePairs(white, n, Math.round(density * interior), limit, rng);
    if (!subdivide(white, n, limit, rng)) return null;

    return hasNoShortRun(white, n) && isConnected(white, n) ? white : null;
}
