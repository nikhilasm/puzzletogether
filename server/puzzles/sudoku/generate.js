/**
 * Sudoku generation: a random solved grid, dug symmetrically, with uniqueness re-proved after
 * every dig (design-spec.md §8).
 *
 * A puzzle is only ever emitted if `countSolutions` says it has exactly one solution, so an
 * ambiguous puzzle cannot reach a player even if the difficulty heuristics are wrong.
 */

import { DIFFICULTY_ORDER, rate } from './rate.js';
import { countSolutions, createDims, randomSolvedGrid } from './solver.js';

/**
 * Clue count to stop digging at once the target difficulty is reached, as a fraction of cells.
 * Digging past this adds nothing — the puzzle is already as hard as was asked for.
 */
const CLUE_FLOOR = { easy: 0.5, medium: 0.4, hard: 0.28 };

/**
 * Rating is skipped while the grid is still this full, since a nearly complete grid always falls
 * to singles and rating it is wasted work.
 */
const RATE_FROM_FRACTION = 0.62;

/**
 * How many whole puzzles to try before accepting the closest rating to the one requested.
 *
 * A single dug grid lands on the exact difficulty asked for only ~15-20% of the time, so the
 * budget has to be generous: at 40 the miss rate is a fraction of a percent, and the cost is paid
 * in a worker thread against a pre-warmed pool, not in front of a waiting host.
 */
const MAX_ATTEMPTS = 40;

/** Difficulty as a comparable rank. */
function rank(difficulty) {
    return DIFFICULTY_ORDER.indexOf(difficulty);
}

/**
 * Digs holes in a solved grid, symmetric about its centre, keeping a dig only when it leaves the
 * puzzle uniquely solvable *and* no harder than the difficulty asked for.
 *
 * Difficulty is measured after each dig rather than inferred from a clue count, because clue count
 * is a poor proxy: two grids with 31 clues can need very different techniques.
 */
function digHoles(solution, dims, difficulty, rng) {
    const cells = Uint8Array.from(solution);
    const total = dims.n * dims.n;
    const targetRank = rank(difficulty);
    const clueFloor = Math.round(total * (CLUE_FLOOR[difficulty] ?? CLUE_FLOOR.medium));
    const rateFrom = Math.round(total * RATE_FROM_FRACTION);
    let clues = total;
    let rating = 'easy';

    const pairs = [];
    for (let idx = 0; idx < Math.floor(total / 2); idx += 1) {
        pairs.push([idx, total - 1 - idx]);
    }
    if (total % 2 === 1) pairs.push([Math.floor(total / 2), Math.floor(total / 2)]);
    rng.shuffle(pairs);

    for (const [a, b] of pairs) {
        if (clues <= clueFloor && rating === difficulty) break;

        const removed = a === b ? [a] : [a, b];
        const previous = removed.map((idx) => cells[idx]);
        for (const idx of removed) cells[idx] = 0;

        const stillUnique = countSolutions(cells, dims, 2) === 1;
        const dugRating =
            stillUnique && clues - removed.length <= rateFrom ? rate(cells, dims.n) : rating;

        if (stillUnique && rank(dugRating) <= targetRank) {
            clues -= removed.length;
            rating = dugRating;
        } else {
            removed.forEach((idx, i) => {
                cells[idx] = previous[i];
            });
        }
    }

    return { cells, clues, difficulty: clues <= rateFrom ? rate(cells, dims.n) : rating };
}

/**
 * Generates a uniquely solvable sudoku at (or as close as possible to) the requested difficulty.
 *
 * Rating is a heuristic and the attempt budget is finite, so an exact match is not guaranteed; the
 * uniqueness guarantee is not a heuristic and always holds.
 *
 * @param {object} options - Generation options.
 * @param {string} options.difficulty - Requested difficulty, one of `DIFFICULTY_ORDER`.
 * @param {number} options.n - Grid side length.
 * @param {import('../rng.js').Rng} options.rng - Seeded generator.
 * @returns {{ cells: Uint8Array, solution: Uint8Array, difficulty: string, clues: number }}
 *   The dug puzzle, its solution, its measured difficulty, and its clue count.
 */
export function generateSudoku({ difficulty, n, rng }) {
    const dims = createDims(n);
    let best = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const solution = randomSolvedGrid(dims, rng);
        const dug = digHoles(solution, dims, difficulty, rng);
        const candidate = { ...dug, solution };

        if (dug.difficulty === difficulty) return candidate;
        if (!best || rank(dug.difficulty) > rank(best.difficulty)) best = candidate;
    }

    return best;
}
