/**
 * Partitioning a grid into suguru's regions: connected, irregular groups of cells, each later filled
 * with a permutation of 1..(its own size). A region of size k caps its cells' domain at 1..k, so a
 * partition of only small regions leaves some 2×2 clique unfillable before a value is tried, which is
 * why easy leans on the reliably fillable sizes and hard leans smaller, with the dig carrying
 * difficulty (ADR-0020, ADR-0021).
 */

/** Region sizes to draw from, per difficulty. */
const REGION_SIZES = {
    easy: [5, 5, 6],
    medium: [4, 5, 5, 6],
    hard: [4, 4, 5, 6],
};

/**
 * How many regions under 3 cells a puzzle may keep, as a fraction of its cells. A region can strand a
 * neighbor with nowhere left to grow, and suguru wants the occasional small region anyway, so this
 * caps the accident rather than suppressing it, the way kenken bounds its single-cell cages.
 */
const SMALL_REGION_ALLOWANCE = { easy: 0.02, medium: 0.04, hard: 0.06 };

/** A region below this size was not drawn deliberately; see SMALL_REGION_ALLOWANCE. */
const SMALL_REGION_CEILING = 2;

/** The orthogonal neighbors of a cell, clipped to the grid. Region growth is orthogonal only. */
function neighbors(idx, n) {
    const row = Math.floor(idx / n);
    const col = idx % n;
    const list = [];
    if (row > 0) list.push(idx - n);
    if (row < n - 1) list.push(idx + n);
    if (col > 0) list.push(idx - 1);
    if (col < n - 1) list.push(idx + 1);
    return list;
}

/**
 * Grows regions outward from random seeds until every cell belongs to one. A region grows by picking
 * from unclaimed cells adjacent to any member, listed once per member touched, which biases growth
 * toward cells the region already surrounds; this is kenken's partition in cages.js, unchanged.
 */
function partition(n, difficulty, rng) {
    const total = n * n;
    const owner = new Int32Array(total).fill(-1);
    const sizes = REGION_SIZES[difficulty] ?? REGION_SIZES.medium;
    const groups = [];

    for (const seed of rng.shuffle(Array.from({ length: total }, (_unused, i) => i))) {
        if (owner[seed] !== -1) continue;

        const id = groups.length;
        const cells = [seed];
        owner[seed] = id;
        const wanted = sizes[rng.int(sizes.length)];

        while (cells.length < wanted) {
            const options = [];
            for (const cell of cells) {
                for (const neighbor of neighbors(cell, n)) {
                    if (owner[neighbor] === -1) options.push(neighbor);
                }
            }
            if (options.length === 0) break;

            const picked = options[rng.int(options.length)];
            owner[picked] = id;
            cells.push(picked);
        }

        groups.push(cells.sort((a, b) => a - b));
    }

    return groups;
}

/**
 * Folds stranded small regions (below SMALL_REGION_CEILING) into a neighbor, down to the difficulty's
 * allowance. Each joins its smallest eligible neighbor so absorbing a stray does not create an
 * unwieldy region; this is kenken's mergeSingletons in cages.js, generalized to strays of one or two.
 */
function mergeSmallRegions(groups, n, maxSize, allowed) {
    const owner = new Int32Array(n * n);
    groups.forEach((cells, id) => {
        for (const cell of cells) owner[cell] = id;
    });

    const merged = groups.map((cells) => [...cells]);
    const dropped = new Set();
    let small = groups.filter((cells) => cells.length <= SMALL_REGION_CEILING).length;

    groups.forEach((cells, id) => {
        if (cells.length > SMALL_REGION_CEILING || dropped.has(id) || small <= allowed) return;

        const hosts = [...new Set(cells.flatMap((cell) => neighbors(cell, n)))]
            .map((neighbor) => owner[neighbor])
            .filter((host) => host !== id && !dropped.has(host) && merged[host].length < maxSize)
            .sort((a, b) => merged[a].length - merged[b].length);

        if (hosts.length === 0) return;
        merged[hosts[0]].push(...cells);
        merged[hosts[0]].sort((a, b) => a - b);
        for (const cell of cells) owner[cell] = hosts[0];
        dropped.add(id);
        small -= 1;
    });

    return merged.filter((_unused, id) => !dropped.has(id));
}

/** Sorts regions by their first cell and renumbers them, so ids match reading order. */
function reindex(groups) {
    return groups
        .slice()
        .sort((a, b) => a[0] - b[0])
        .map((cells, id) => ({ id, cells }));
}

/** Region size, per cell, for a grouping that has not been reindexed yet. */
function sizeOfCell(groups, n) {
    const sizes = new Uint8Array(n * n);
    groups.forEach((cells) => {
        for (const cell of cells) sizes[cell] = cells.length;
    });
    return sizes;
}

/**
 * Whether some 2×2 block can never hold four pairwise-distinct values, given each cell's domain is
 * exactly 1..(its region's size). Every domain is a range from 1, so Hall's theorem collapses to a
 * sorted check: the block fails iff its i-th smallest region size is below i, and since a 2×2 block is
 * the tightest adjacency clique, no filling of the rest of the grid could route around a violation.
 */
function hasImpossibleBlock(groups, n) {
    const sizes = sizeOfCell(groups, n);

    for (let row = 0; row < n - 1; row += 1) {
        for (let col = 0; col < n - 1; col += 1) {
            const idx = row * n + col;
            const block = [sizes[idx], sizes[idx + 1], sizes[idx + n], sizes[idx + n + 1]].sort(
                (a, b) => a - b,
            );
            if (block.some((size, i) => size < i + 1)) return true;
        }
    }

    return false;
}

/** How many partitions to draw looking for one with no provably-impossible 2×2 block. */
const PARTITION_ATTEMPTS = 40;

/**
 * Partitions a grid into suguru's regions.
 *
 * @param {number} n - Grid side length.
 * @param {string} difficulty - Requested difficulty; selects the size distribution.
 * @param {import('../rng.js').Rng} rng - Seeded generator.
 * @returns {{ id: number, cells: number[] }[]} The puzzle's regions, ids matching reading order.
 */
export function buildRegions(n, difficulty, rng) {
    const sizes = REGION_SIZES[difficulty] ?? REGION_SIZES.medium;
    const allowance = SMALL_REGION_ALLOWANCE[difficulty] ?? SMALL_REGION_ALLOWANCE.medium;
    const maxSize = Math.max(...sizes);
    const smallCap = Math.round(n * n * allowance);

    let groups = null;
    for (let attempt = 0; attempt < PARTITION_ATTEMPTS; attempt += 1) {
        const drawn = mergeSmallRegions(partition(n, difficulty, rng), n, maxSize, smallCap);
        groups = drawn;
        if (!hasImpossibleBlock(drawn, n)) break;
    }

    return reindex(groups);
}
