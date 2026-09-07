/**
 * Suguru generation: a region partition, filled whole, then dug like a sudoku (design-spec.md §8,
 * ADR-0020). Partition and fill are kept or discarded together, since a region's size caps its cells'
 * digits, so a partition can be unfillable or off-difficulty; either way the whole attempt is redrawn
 * fresh, and digging supplies the givens without which a suguru is never unique.
 */

import { rateSuguru } from './rate.js';
import { buildRegions } from './regions.js';
import { countSolutions, randomFilledGrid } from './solver.js';

/**
 * Clue count to stop digging at once the target difficulty is reached, as a fraction of cells. An
 * unconstrained dig converges near 0.22-0.32 and always rates hard, so these floors sit above that
 * natural minimum by a margin that shrinks from easy to hard.
 */
const CLUE_FLOOR = { easy: 0.4, medium: 0.36, hard: 0.3 };

/**
 * Rating is skipped while the grid is still this full, since a nearly complete grid always falls to
 * naked singles and rating it is wasted work.
 */
const RATE_FROM_FRACTION = 0.65;

/**
 * How many whole attempts, partition and fill both, to try before accepting the closest rating to the
 * one requested. Generous because a partition the fill search cannot complete fails in well under a
 * millisecond, so the budget below governs a slow run rather than this count.
 */
const MAX_ATTEMPTS = 2000;

/** Wall-clock ceiling on the search for a puzzle at the difficulty asked for. */
const TIME_BUDGET_MS = 5000;

/**
 * How long to spend drawing from the requested difficulty's own region pool before falling back to
 * easy's, once nothing has filled at all. Nothing filled means the pool and grid size cannot fill
 * rather than bad luck, so it falls back to easy's measured-fillable sizes; the dig still decides the
 * rating, so only the region layout's character is lost, not the label.
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
 * puzzle uniquely solvable and no harder than the difficulty asked for. Holes are dug in plain
 * shuffled order rather than sudoku's symmetric pairs, since irregular regions would not read as a
 * symmetric grid anyway.
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
 *   clues: number }} The dug puzzle, its solution, its regions, its measured difficulty, and its clue
 *   count. Never null: a search that finds nothing on the requested band settles for the nearest.
 * @throws {Error} If neither the requested pool nor the fallback filled a single partition inside the
 *   budget; thrown rather than returned as null because callers dereference the result.
 */
export function generateSuguru({ difficulty, n, rng }) {
    const started = Date.now();
    let best = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const pool = best || Date.now() - started < FALLBACK_AFTER_MS ? difficulty : 'easy';
        const regions = buildRegions(n, pool, rng);

        // A partition can pack small regions so tightly no filling satisfies them all at once: a 2×2
        // block split into two dominoes needs four distinct values from a shared two-value domain.
        // Treated like an off-difficulty draw: the whole attempt is worth nothing and the next draws
        // fresh.
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
