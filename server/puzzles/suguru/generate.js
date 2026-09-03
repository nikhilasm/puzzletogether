/**
 * Suguru generation: a region partition, filled whole, then dug like a sudoku (design-spec.md §8,
 * ADR-0020).
 *
 * **Partition and fill happen together, and neither is dug from the other's leftovers.** A region's
 * size caps which digits are legal inside it, so unlike kenken's cages, splitting a region after the
 * grid is filled could orphan a digit its new, smaller domain does not allow (ADR-0020). So a whole
 * attempt is one region partition, filled once by backtracking, and if digging holes out of it
 * cannot reach a uniquely solvable puzzle at the requested difficulty, the *whole* attempt, partition
 * included, is discarded and redrawn with a fresh seed rather than repaired.
 *
 * **A partition can also simply be unfillable, discovered only once the fill search gives up.** A
 * region's size caps its cells' domain, so a partition drawn too small, or too small too often, can
 * ask a 2×2 block of the grid, every one of which needs four pairwise-distinct values, for a fourth
 * value no cell present is allowed to hold. That is not a hard fill, it is an impossible one however
 * long the search runs, so regions.js draws with that in mind and this loop treats an unfillable
 * partition exactly like an off-difficulty one: worth nothing, redrawn fresh.
 *
 * **Digging is what a bare partition-and-fill cannot skip.** A completed grid with no cell dug out
 * has no given anybody can read the puzzle from, and a suguru with no givens is essentially never
 * unique: nothing stops a whole region's digits from being relabelled by any permutation that still
 * respects its neighbours. Sudoku's dig loop is the shape this borrows, holes removed one at a time
 * and uniqueness re-proved after each with a counting solver.
 */

import { rateSuguru } from './rate.js';
import { buildRegions } from './regions.js';
import { countSolutions, randomFilledGrid } from './solver.js';

/**
 * Clue count to stop digging at once the target difficulty is reached, as a fraction of cells.
 * Digging past this adds nothing: the puzzle is already as hard as was asked for.
 *
 * A dig with no floor at all converges to about 0.22-0.32 regardless of size and rates 'hard'
 * every time (measured directly), which is this puzzle's natural, unconstrained minimum. These
 * floors sit above that minimum by an amount that shrinks from easy to hard rather than one fixed
 * distance, since 'hard' already asks for close to the natural floor and has little room left to
 * give.
 */
const CLUE_FLOOR = { easy: 0.4, medium: 0.36, hard: 0.3 };

/**
 * Rating is skipped while the grid is still this full, since a nearly complete grid always falls to
 * naked singles and rating it is wasted work.
 */
const RATE_FROM_FRACTION = 0.65;

/**
 * How many whole attempts, partition and fill both, to try before accepting the closest rating to
 * the one requested.
 *
 * Generous, because most of what this spends is cheap: a partition the fill search cannot complete
 * fails in well under a millisecond (regions.js), so the budget below is what actually governs a
 * slow run, not this count.
 */
const MAX_ATTEMPTS = 2000;

/** Wall-clock ceiling on the search for a puzzle at the difficulty asked for. */
const TIME_BUDGET_MS = 5000;

/**
 * How long to spend drawing from the requested difficulty's own region pool before falling back to
 * easy's, once nothing has filled at all.
 *
 * Nothing filled means every draw so far was an unfillable partition rather than an off-difficulty
 * one, which is a fact about the pool and the grid size, not about luck: the remaining budget spent
 * on the same pool would buy more of the same. Easy's sizes are the ones measured to fill at every
 * offered size (regions.js), and the dig still decides the rating, so falling back to them costs
 * the region layout's character and not the difficulty the puzzle is labelled with.
 */
const FALLBACK_AFTER_MS = TIME_BUDGET_MS / 2;

/** Difficulty as a comparable rank. */
function rank(difficulty) {
    return ['easy', 'medium', 'hard'].indexOf(difficulty);
}

/** How far a measured rating sits from the one asked for, counted in bands. */
function bandsApart(measured, wanted) {
    return Math.abs(rank(measured) - rank(wanted));
}

/**
 * Digs holes in a solved grid, one at a time in random order, keeping a dig only when it leaves the
 * puzzle uniquely solvable *and* no harder than the difficulty asked for.
 *
 * Unlike sudoku's symmetric pairs, holes here are dug in plain shuffled order: the regions are
 * already irregular, so a symmetric clue pattern would not read as a symmetric grid and is not worth
 * the constraint on top of everything else digging already has to satisfy.
 */
function digHoles(solution, regions, n, difficulty, rng) {
    const cells = Uint8Array.from(solution);
    const total = n * n;
    const targetRank = rank(difficulty);
    const clueFloor = Math.round(total * (CLUE_FLOOR[difficulty] ?? CLUE_FLOOR.medium));
    const rateFrom = Math.round(total * RATE_FROM_FRACTION);
    let clues = total;
    let rating = 'easy';

    const order = rng.shuffle(Array.from({ length: total }, (_unused, i) => i));

    for (const idx of order) {
        if (clues <= clueFloor && rating === difficulty) break;

        const previous = cells[idx];
        cells[idx] = 0;

        const { count, complete } = countSolutions(cells, regions, n, 2);
        const stillUnique = complete && count === 1;
        const dugRating =
            stillUnique && clues - 1 <= rateFrom ? rateSuguru({ cells, regions, n }) : rating;

        if (stillUnique && rank(dugRating) <= targetRank) {
            clues -= 1;
            rating = dugRating;
        } else {
            cells[idx] = previous;
        }
    }

    return {
        cells,
        clues,
        difficulty: clues <= rateFrom ? rateSuguru({ cells, regions, n }) : rating,
    };
}

/**
 * Generates a uniquely solvable suguru at (or as close as possible to) the requested difficulty.
 *
 * @param {object} options - Generation options.
 * @param {string} options.difficulty - Requested difficulty, one of DIFFICULTY_ORDER.
 * @param {number} options.n - Grid side length.
 * @param {import('../rng.js').Rng} options.rng - Seeded generator.
 * @returns {{ cells: Uint8Array, solution: Uint8Array, regions: object[], difficulty: string,
 *   clues: number }} The dug puzzle, its solution, its regions, its measured difficulty, and its
 *   clue count. Never null: a search that finds nothing on the band asked for settles for the
 *   nearest band it did find, the way the pool settles (pool.js).
 * @throws {Error} If neither the requested pool nor the fallback filled a single partition inside
 *   the budget. Callers dereference the result, so this is thrown rather than returned as null:
 *   create propagates it and the socket handler acks a failure with its message.
 */
export function generateSuguru({ difficulty, n, rng }) {
    const started = Date.now();
    let best = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const pool = best || Date.now() - started < FALLBACK_AFTER_MS ? difficulty : 'easy';
        const regions = buildRegions(n, pool, rng);

        // A partition can pack small regions tightly enough that no filling satisfies both of them
        // at once: a 2×2 block split into two dominoes needs four distinct values from the two
        // dominoes' shared two-value domain, which is not a bug in the search, it is the partition
        // asking for something no grid can give it. Caught here and treated the same as an
        // off-difficulty draw: the whole attempt, partition included, is worth nothing and the next
        // one draws fresh.
        let solution;
        try {
            solution = randomFilledGrid(regions, n, rng);
        } catch {
            if (Date.now() - started > TIME_BUDGET_MS) break;
            continue;
        }

        const dug = digHoles(solution, regions, n, difficulty, rng);
        const candidate = { ...dug, solution, regions };

        if (dug.difficulty === difficulty) return candidate;

        // Nearest band, not hardest seen: an easy request that never rates easy is better served by
        // a medium puzzle than by the hard one a rank comparison would have preferred.
        const nearer =
            !best ||
            bandsApart(dug.difficulty, difficulty) < bandsApart(best.difficulty, difficulty);
        if (nearer) best = candidate;
        if (Date.now() - started > TIME_BUDGET_MS) break;
    }

    if (!best) throw new Error(`no fillable ${n}x${n} suguru partition found within budget`);
    return best;
}
