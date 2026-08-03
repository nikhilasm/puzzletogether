/**
 * KenKen generation: a random Latin square, partitioned into cages, tightened until it has exactly
 * one answer (design-spec.md §8).
 *
 * The order matters. Sudoku starts from a full grid and *removes* information, re-proving uniqueness
 * after each dig. KenKen starts from a partition that is usually too loose and *adds* information by
 * splitting cages, for the same reason: the expensive check is uniqueness, so the search should
 * approach it from the side where it can stop the moment the answer is yes.
 *
 * A time budget and retry cap are the mitigation design-spec.md §14 asks for. They bound how long
 * generation *searches for a good puzzle*, not whether it produces one — the refinement loop always
 * terminates in a uniquely solvable grid.
 */

import { buildCages, splitLargestCage } from './cages.js';
import { countSolutions, randomLatinSquare } from './solver.js';

/**
 * How many fresh Latin squares to try before settling for the best partition seen.
 *
 * A partition drawn straight from the size distribution is uniquely solvable often enough that this
 * rarely runs out; it exists so a run of unlucky draws costs a bounded amount of time.
 */
const MAX_ATTEMPTS = 24;

/**
 * Wall-clock ceiling on the search for a puzzle that needed no splitting.
 *
 * Generation runs in a worker thread against a pre-warmed pool, so this is not a latency budget a
 * player ever waits on — it is a ceiling on how much CPU one puzzle may cost while a 7×7 is being
 * looked for.
 */
const TIME_BUDGET_MS = 3000;

/**
 * Splits cages until the partition admits exactly one solution.
 *
 * Returns how many splits that took, which is the quality signal the caller sorts on: zero means
 * the partition the difficulty distribution produced was already unique, and every split after that
 * is one cage of the requested shape traded for two smaller ones.
 */
function refineToUnique(solution, n, difficulty, rng) {
    let cages = buildCages(solution, n, difficulty, rng);

    for (let splits = 0; splits <= n * n; splits += 1) {
        if (countSolutions(cages, n, 2) === 1) return { cages, solution, splits };

        const next = splitLargestCage(cages, solution, difficulty, n, rng);
        if (!next) break;
        cages = next;
    }

    // Unreachable: a partition of single-cell cages names every digit, so it is uniquely solvable
    // and the loop above returns before running out of cages to split.
    throw new Error(`kenken: no unique partition for ${n}×${n}`);
}

/**
 * Generates a uniquely solvable KenKen at the requested difficulty.
 *
 * @param {object} options - Generation options.
 * @param {string} options.difficulty - Requested difficulty; selects the cage distributions.
 * @param {number} options.n - Grid side length.
 * @param {import('../rng.js').Rng} options.rng - Seeded generator.
 * @returns {{ cages: object[], solution: Uint8Array, splits: number }} The puzzle's cages, its
 *   solved grid, and how many splits were needed to make it unique.
 */
export function generateKenken({ difficulty, n, rng }) {
    const started = Date.now();
    let best = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const candidate = refineToUnique(randomLatinSquare(n, rng), n, difficulty, rng);

        if (candidate.splits === 0) return candidate;
        if (!best || candidate.splits < best.splits) best = candidate;
        if (Date.now() - started > TIME_BUDGET_MS) break;
    }

    return best;
}
