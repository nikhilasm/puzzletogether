/**
 * Partitioning a solved Latin square into cages, and giving each cage its arithmetic clue.
 *
 * **Difficulty here is a generation parameter, not a measurement.** Cage sizes and the mix of
 * operations are drawn from a distribution per difficulty, and doc.difficulty is the difficulty
 * that was asked for. This is a deliberate split from sudoku, which rates what it actually dug and
 * labels the puzzle with the measured result; rating a KenKen honestly would mean a
 * technique-ranked cage solver, and that is the same expensive search that already dominates
 * generation. Recorded in docs/TODO.md so the difference is a decision rather than an oversight.
 *
 * What is *not* a heuristic is uniqueness: generate.js refuses to emit a partition until the
 * solver has proved it admits exactly one answer.
 */

/**
 * Cage sizes to draw from, per difficulty. Sampling uniformly from a list with repeats is the
 * weighting: an easy puzzle is mostly pairs, a hard one mostly triples and up.
 *
 * No list offers 1. A single-cell cage is a free digit, and how many of those a puzzle gets is
 * decided by SINGLE_CELL_ALLOWANCE rather than here, because asking for them is not what produces
 * them; see mergeSingletons.
 */
const CAGE_SIZES = {
    easy: [2, 2, 2, 3, 3],
    medium: [2, 2, 3, 3, 4],
    hard: [2, 3, 3, 4, 4, 5],
};

/**
 * How many single-cell cages a puzzle may keep, as a fraction of its cells.
 *
 * Growth strands singletons whatever the size distribution says: a cage that fills the last gap in
 * its corner leaves the cell beside it with no unclaimed neighbor to join. Left alone that produced
 * nine free digits in a 7×7 easy and seven in a medium, an opening handful that solves itself. The
 * allowance is a ceiling on that accident, and zero at hard makes it a rule.
 */
const SINGLE_CELL_ALLOWANCE = { easy: 0.08, medium: 0.02, hard: 0 };

/**
 * How often each operation is chosen, per difficulty, among those a cage can legally carry.
 *
 * Harder puzzles lean on multiplication and division because factoring a target into candidate
 * digit sets is more work than bracketing a sum.
 */
const OP_WEIGHTS = {
    easy: { '+': 5, '-': 4, '*': 2, '/': 2 },
    medium: { '+': 4, '-': 3, '*': 3, '/': 3 },
    hard: { '+': 3, '-': 2, '*': 4, '/': 4 },
};

/** Above this, a multiplication clue needs four digits, which will not fit a cell corner. */
const MAX_PRODUCT_TARGET = 999;

/** How each operation is drawn in the corner of a cage's top-left cell. */
const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' };

/** The orthogonal neighbors of a cell, clipped to the grid. */
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

/** Whether a set of cells forms one orthogonally connected region. */
function isConnected(cells, n) {
    if (cells.length <= 1) return true;

    const members = new Set(cells);
    const seen = new Set([cells[0]]);
    const queue = [cells[0]];

    while (queue.length > 0) {
        for (const neighbor of neighbors(queue.pop(), n)) {
            if (!members.has(neighbor) || seen.has(neighbor)) continue;
            seen.add(neighbor);
            queue.push(neighbor);
        }
    }

    return seen.size === cells.length;
}

/** Picks one option, weighted by its operation. */
function pickWeighted(options, weights, rng) {
    const total = options.reduce((running, option) => running + (weights[option.op] ?? 1), 0);
    let roll = rng.next() * total;

    for (const option of options) {
        roll -= weights[option.op] ?? 1;
        if (roll < 0) return option;
    }
    return options.at(-1);
}

/**
 * Chooses the operation and target for one cage, from those its solution values can actually
 * support.
 *
 * A cage only offers subtraction or division when its two digits differ: 0− and 1÷ are
 * technically true but tell a solver almost nothing, and they read as mistakes.
 */
function clueFor(cells, solution, difficulty, rng) {
    const values = cells.map((idx) => solution[idx]);
    if (values.length === 1) return { op: '=', target: values[0] };

    const sum = values.reduce((running, value) => running + value, 0);
    const product = values.reduce((running, value) => running * value, 1);

    const legal = [{ op: '+', target: sum }];
    if (product <= MAX_PRODUCT_TARGET) legal.push({ op: '*', target: product });

    if (values.length === 2) {
        const high = Math.max(values[0], values[1]);
        const low = Math.min(values[0], values[1]);
        if (high !== low) {
            legal.push({ op: '-', target: high - low });
            if (high % low === 0) legal.push({ op: '/', target: high / low });
        }
    }

    return pickWeighted(legal, OP_WEIGHTS[difficulty] ?? OP_WEIGHTS.medium, rng);
}

/**
 * Grows cages outward from random seeds until every cell belongs to one.
 *
 * A cage grows by picking from the list of unclaimed cells adjacent to *any* of its members, and
 * that list holds a cell once per member it touches. The repetition is the point: it biases growth
 * toward cells the cage already surrounds, which produces the compact blobs the mock shows rather
 * than the long snaking tendrils an unweighted pick gives.
 */
function partition(n, difficulty, rng) {
    const total = n * n;
    const owner = new Int32Array(total).fill(-1);
    const sizes = CAGE_SIZES[difficulty] ?? CAGE_SIZES.medium;
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
 * Folds stranded single-cell groups into a neighbor, down to the difficulty's allowance.
 *
 * Each one joins its *smallest* eligible neighbor, so absorbing a stray cell does not turn a
 * three-cell cage into an unwieldy six-cell one.
 */
function mergeSingletons(groups, n, maxSize, allowed) {
    const owner = new Int32Array(n * n);
    groups.forEach((cells, id) => {
        for (const cell of cells) owner[cell] = id;
    });

    const merged = groups.map((cells) => [...cells]);
    const dropped = new Set();
    let singletons = groups.filter((cells) => cells.length === 1).length;

    groups.forEach((cells, id) => {
        if (cells.length !== 1 || dropped.has(id) || singletons <= allowed) return;

        const hosts = neighbors(cells[0], n)
            .map((neighbor) => owner[neighbor])
            .filter((host) => host !== id && !dropped.has(host) && merged[host].length < maxSize)
            .sort((a, b) => merged[a].length - merged[b].length);

        if (hosts.length === 0) return;
        merged[hosts[0]].push(cells[0]);
        merged[hosts[0]].sort((a, b) => a - b);
        owner[cells[0]] = hosts[0];
        dropped.add(id);
        singletons -= 1;
    });

    return merged.filter((_unused, id) => !dropped.has(id));
}

/** Sorts cages by their top-left cell and renumbers them, so ids match reading order. */
function reindex(cages) {
    return cages
        .slice()
        .sort((a, b) => a.cells[0] - b.cells[0])
        .map((cage, id) => ({ ...cage, id }));
}

/**
 * Partitions a solved grid into clued cages.
 *
 * @param {Uint8Array} solution - The solved Latin square.
 * @param {number} n - Grid side length.
 * @param {string} difficulty - Requested difficulty; selects the size and operation distributions.
 * @param {import('../rng.js').Rng} rng - Seeded generator.
 * @returns {{ id: number, cells: number[], op: string, target: number }[]} The puzzle's cages.
 */
export function buildCages(solution, n, difficulty, rng) {
    const sizes = CAGE_SIZES[difficulty] ?? CAGE_SIZES.medium;
    const allowance = SINGLE_CELL_ALLOWANCE[difficulty] ?? SINGLE_CELL_ALLOWANCE.medium;
    const groups = mergeSingletons(
        partition(n, difficulty, rng),
        n,
        Math.max(...sizes),
        Math.round(n * n * allowance),
    );

    return reindex(
        groups.map((cells) => ({ cells, ...clueFor(cells, solution, difficulty, rng) })),
    );
}

/**
 * Splits the largest cage in two, which strictly tightens the puzzle.
 *
 * This is how generation always terminates. Peeling a cell off a cage replaces one loose constraint
 * with two tighter ones, and repeating it far enough leaves every cell in a cage of its own, where
 * each clue simply names its digit, a partition that is trivially unique. So the refinement loop in
 * generate.js cannot fail to find an answer; at worst it finds an easy one.
 *
 * The cell peeled off is chosen from those whose removal leaves the rest of the cage connected. A
 * connected region of two or more cells always has at least two such cells, so the choice exists.
 *
 * @param {{ id: number, cells: number[], op: string, target: number }[]} cages - Current cages.
 * @param {Uint8Array} solution - The solved grid, for re-cluing the two new cages.
 * @param {string} difficulty - Requested difficulty, for the operation weights.
 * @param {number} n - Grid side length.
 * @param {import('../rng.js').Rng} rng - Seeded generator.
 * @returns {object[]|null} The new cage set, or null when every cage is already a single cell.
 */
export function splitLargestCage(cages, solution, difficulty, n, rng) {
    let target = -1;
    for (const [i, cage] of cages.entries()) {
        if (cage.cells.length < 2) continue;
        if (target === -1 || cage.cells.length > cages[target].cells.length) target = i;
    }
    if (target === -1) return null;

    const { cells } = cages[target];
    const peelable = cells.filter((cell) =>
        isConnected(
            cells.filter((other) => other !== cell),
            n,
        ),
    );
    const peeled = peelable[rng.int(peelable.length)];
    const rest = cells.filter((cell) => cell !== peeled);

    return reindex([
        ...cages.filter((_unused, i) => i !== target),
        { cells: [peeled], ...clueFor([peeled], solution, difficulty, rng) },
        { cells: rest, ...clueFor(rest, solution, difficulty, rng) },
    ]);
}

/**
 * The clue as it is drawn in the corner of the cage's top-left cell.
 *
 * A single-cell cage shows its digit alone: 3, not 3=. The equals sign would be the only
 * operator in the puzzle with nothing on the other side of it.
 *
 * @param {{ op: string, target: number }} cage - The cage to label.
 * @returns {string} The label, e.g. '12+' or '3÷'.
 */
export function cageLabel(cage) {
    return `${cage.target}${OP_SYMBOL[cage.op] ?? ''}`;
}
