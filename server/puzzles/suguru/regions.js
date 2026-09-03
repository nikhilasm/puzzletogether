/**
 * Partitioning a grid into suguru's regions: connected, irregular groups of cells, each later
 * filled with a permutation of 1..(its own size).
 *
 * The flood-fill itself is kenken's `partition()` (cages.js) minus the arithmetic step: grow a
 * region outward from a random seed, biased toward cells it already surrounds, until it reaches a
 * size drawn from the difficulty's distribution or runs out of room. Duplicated rather than shared,
 * per ADR-0020's Consequences: the two are close enough to look like they should share code and far
 * enough apart (kenken's is arithmetic-free growth alone; this one also folds small regions) that
 * merging them was judged not worth doing until a second caller shows what they actually have in
 * common.
 *
 * **Region size is bounded below by a fact about the grid, not by taste.** Every cell is adjacent,
 * orthogonally or diagonally, to up to eight others, so a 2×2 block is a clique of four
 * mutually-touching cells and always needs four pairwise-distinct values. A region of size k gives
 * its own cells a domain of only 1..k, so a partition drawn entirely from size-3 regions cannot ever
 * place a 4 anywhere: every 2×2 block, and there is always at least one, is unfillable *before a
 * single value is tried*, regardless of the rest of the grid or how many times it is redrawn. So
 * **easy leans on the sizes that are reliably fillable, and hard leans smaller**, which inverts
 * kenken's cage-size intuition but is the shape the fill search actually rewards: a harder suguru is
 * smaller, more varied regions asking more of the solver, not a bigger search asking more of the
 * generator.
 *
 * **How much smaller is bounded by the grid, not by taste, and the bound moves with the grid.** A
 * pool holding a 3 costs little at 6×6 and costs everything at 9×9: measured over 300 draws per
 * size, [3, 4, 4, 5] filled 18% of the time at 5×5, 9% at 6×6, 2.7% at 7×7, and not once at 8×8 or
 * 9×9, where the partitions it draws are provably unfillable rather than merely hard. Hard therefore
 * floors at 4, which fills at every offered size and still measures hard once dug, since the rating
 * is carried by the dig and not by region size (ADR-0021 Revisions).
 */

/** Region sizes to draw from, per difficulty. */
const REGION_SIZES = {
    easy: [5, 5, 6],
    medium: [4, 5, 5, 6],
    hard: [4, 4, 5, 6],
};

/**
 * How many regions under 3 cells a puzzle may keep, as a fraction of its cells.
 *
 * A region growing to fill the last gap in a corner can strand its neighbour with nowhere left to
 * grow, producing a 1- or 2-cell region nobody asked for outright. Suguru wants the occasional one of
 * these anyway, so this is a ceiling on the accident rather than a suppression of it: a small handful
 * are let through and no more, the way kenken bounds its own single-cell cages.
 */
const SMALL_REGION_ALLOWANCE = { easy: 0.02, medium: 0.04, hard: 0.06 };

/** A region below this size was not drawn deliberately; see SMALL_REGION_ALLOWANCE. */
const SMALL_REGION_CEILING = 2;

/** The orthogonal neighbours of a cell, clipped to the grid. Region growth is orthogonal only. */
function neighbours(idx, n) {
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
 * Grows regions outward from random seeds until every cell belongs to one.
 *
 * A region grows by picking from the list of unclaimed cells adjacent to *any* of its members, and
 * that list holds a cell once per member it touches, which biases growth toward cells the region
 * already surrounds. See kenken's `partition()` in cages.js: this is that function, unchanged.
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
                for (const neighbour of neighbours(cell, n)) {
                    if (owner[neighbour] === -1) options.push(neighbour);
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
 * Folds stranded small regions (below SMALL_REGION_CEILING) into a neighbour, down to the
 * difficulty's allowance.
 *
 * Each one joins its *smallest* eligible neighbour, so absorbing a stray cell does not turn a
 * three-cell region into an unwieldy six-cell one. See kenken's `mergeSingletons` in cages.js: the
 * same fold, generalized from exactly one stray cell to a stray region of one or two.
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

        const hosts = [...new Set(cells.flatMap((cell) => neighbours(cell, n)))]
            .map((neighbour) => owner[neighbour])
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
 * Whether some 2×2 block of the grid can never hold four pairwise-distinct values, given each
 * cell's domain is exactly 1..(its own region's size).
 *
 * Every cell's domain is a range starting at 1, which is what makes this cheap: Hall's marriage
 * theorem for a set of ranges-from-1 collapses to a sorted comparison, a system of distinct
 * representatives exists for the block iff, sorting its four region sizes ascending, the i-th
 * smallest is at least i. Two adjacent 2-cell regions filling a 2×2 block between them is the
 * simplest failing case: sizes [2, 2, 2, 2] needs a third distinct value at the third smallest and
 * has none. Flooring REGION_SIZES at 4 makes this rare, since it now takes two accidental strand
 * leftovers landing in the same block rather than an ordinary difficulty draw; it is kept as a cheap
 * defence against exactly that rather than removed.
 *
 * A 2×2 block is the tightest adjacency clique the grid has, every one of its cells touches every
 * other, orthogonally or diagonally, so a violation here is not a corner the fill search could route
 * around: no filling of the rest of the grid changes what four values these four cells could hold.
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
