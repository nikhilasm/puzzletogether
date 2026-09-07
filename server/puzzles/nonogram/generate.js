/**
 * Nonogram generation: draw a bitmap, clue it, and keep it only if the line-solver can finish it,
 * since an ambiguous nonogram can only be guessed (design-spec.md §8). Difficulty is the sweep count
 * solving took, measured rather than requested, with density steering toward the band asked for.
 */

import { cluesFor, lineSolve } from './line-solver.js';

/**
 * Fill fraction to aim at per difficulty. Sparse and dense grids are both easy, so harder
 * difficulties aim closer to half where the interesting puzzles live.
 */
const DENSITY = { easy: 0.62, medium: 0.55, hard: 0.48 };

/**
 * Sweeps to rate a puzzle at, as a fraction of the grid's side, normalised since information
 * propagates one row and column per sweep. Calibrated against measured sweep counts so the bands sit
 * where the density targets separate.
 */
const SWEEP_BANDS = { medium: 0.3, hard: 0.45 };

/** How many bitmaps to draw before settling for the closest rating found. */
const MAX_ATTEMPTS = 120;

/** Difficulty as a comparable rank. */
const ORDER = ['easy', 'medium', 'hard'];

/**
 * Draws the bitmap a puzzle is made from, the seam for a sprite library since swapping in a picture
 * later changes only this function. Cells are drawn independently at the target density rather than
 * as blobs, whose longer runs the overlap deduction eats first and made grids uniformly easy.
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
