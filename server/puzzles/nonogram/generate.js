/**
 * Nonogram generation: draw a bitmap, clue it, and keep it only if the line-solver can finish it
 * (design-spec.md §8).
 *
 * The rejection is the whole point. A random bitmap is trivial to produce and most of them make bad
 * puzzles — not because they are hard, but because they are *ambiguous*, and an ambiguous nonogram
 * cannot be solved, only guessed. Every candidate is therefore solved before it is offered, and one
 * the solver cannot finish is thrown away rather than shipped with a warning.
 *
 * Difficulty is the sweep count that solving took, so the label is measured rather than requested.
 * Density steers the search toward the band that was asked for, the way sudoku's dig targets steer
 * toward a rating — but as with sudoku, what comes back is the rating the puzzle actually earned.
 */

import { cluesFor, lineSolve } from './line-solver.js';

/**
 * Fill fraction to aim at per difficulty.
 *
 * Sparse grids and dense grids are both easy — a nearly empty line has few places its blocks can go,
 * and a nearly full one is mostly forced. The interesting puzzles live in the middle, so harder
 * difficulties aim closer to half.
 */
const DENSITY = { easy: 0.62, medium: 0.55, hard: 0.48 };

/**
 * Sweeps to rate a puzzle at, as a fraction of the grid's side.
 *
 * Normalised by size because a bigger grid needs more sweeps for the same reasoning to travel across
 * it: information propagates one row and one column per sweep, so an unnormalised threshold would
 * call every large puzzle hard and every small one easy. Calibrated against measured sweep counts at
 * each offered size — the bands sit where the three density targets actually separate.
 */
const SWEEP_BANDS = { medium: 0.3, hard: 0.45 };

/** How many bitmaps to draw before settling for the closest rating found. */
const MAX_ATTEMPTS = 120;

/** Difficulty as a comparable rank. */
const ORDER = ['easy', 'medium', 'hard'];

/**
 * Draws the bitmap a puzzle is made from.
 *
 * **This is the seam for a sprite library.** Recognisable images are a real part of nonogram's
 * appeal, but they are a content job rather than a code one, and every hand-drawn sprite still has to
 * survive the same uniqueness rejection as a random bitmap — so the pipeline around this function is
 * what matters, and swapping in a picture later changes only this function.
 *
 * Cells are drawn independently at the target density rather than as blobs. Clustered pixels make a
 * prettier picture, but they also make longer runs, and long runs are what the overlap deduction eats
 * first: blob-drawn grids came out uniformly easy.
 */
function drawBitmap(rows, cols, density, rng) {
    const cells = new Uint8Array(rows * cols);
    for (let idx = 0; idx < cells.length; idx += 1) {
        cells[idx] = rng.next() < density ? 1 : 0;
    }
    return cells;
}

/** The row and column clue lists for a bitmap. */
function cluesOf(cells, rows, cols) {
    const rowClues = [];
    const colClues = [];

    for (let row = 0; row < rows; row += 1) {
        rowClues.push(
            cluesFor(Array.from({ length: cols }, (_unused, col) => cells[row * cols + col])),
        );
    }
    for (let col = 0; col < cols; col += 1) {
        colClues.push(
            cluesFor(Array.from({ length: rows }, (_unused, row) => cells[row * cols + col])),
        );
    }

    return { rowClues, colClues };
}

/** Where a sweep count falls in the difficulty bands, for a grid of this side. */
function rate(sweeps, side) {
    if (sweeps >= side * SWEEP_BANDS.hard) return 'hard';
    if (sweeps >= side * SWEEP_BANDS.medium) return 'medium';
    return 'easy';
}

/**
 * Generates a uniquely solvable nonogram at, or as close as possible to, the requested difficulty.
 *
 * @param {object} options - Generation options.
 * @param {string} options.difficulty - Requested difficulty.
 * @param {number} options.rows - Row count.
 * @param {number} options.cols - Column count.
 * @param {import('../rng.js').Rng} options.rng - Seeded generator.
 * @returns {{ cells: Uint8Array, rowClues: number[][], colClues: number[][], difficulty: string,
 *   sweeps: number }} The solved bitmap, its clues, and the difficulty it measured at.
 */
export function generateNonogram({ difficulty, rows, cols, rng }) {
    const side = Math.max(rows, cols);
    const wanted = DENSITY[difficulty] ?? DENSITY.medium;
    const target = ORDER.indexOf(difficulty);
    let best = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        // Jitter the density a little each attempt, so a run of rejections explores rather than
        // redrawing the same kind of grid until the budget runs out.
        const density = wanted + (rng.next() - 0.5) * 0.12;
        const cells = drawBitmap(rows, cols, density, rng);
        const { rowClues, colClues } = cluesOf(cells, rows, cols);

        const solved = lineSolve(rowClues, colClues, rows, cols);
        if (!solved?.solved) continue;

        const measured = rate(solved.sweeps, side);
        const candidate = {
            cells,
            rowClues,
            colClues,
            difficulty: measured,
            sweeps: solved.sweeps,
        };

        if (measured === difficulty) return candidate;
        // Nothing has been found yet, or this one lands nearer the difficulty that was asked for.
        const distance = Math.abs(ORDER.indexOf(measured) - target);
        if (!best || distance < Math.abs(ORDER.indexOf(best.difficulty) - target)) {
            best = candidate;
        }
    }

    return best;
}
