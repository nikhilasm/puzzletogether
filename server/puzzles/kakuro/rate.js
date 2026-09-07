/**
 * Difficulty rating by how much work the rules do before a solver has to guess (design-spec.md §8).
 * Measured rather than asked for, by the same propagator that proves the puzzle fair: how many sweeps
 * it takes to settle the grid is a property of the puzzle, and a grid the rules cannot settle is hard.
 */

import { analyseRun, initialDomains } from './solver.js';

/** Difficulty labels, ordered easiest first. */
export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

/**
 * Where the bands sit, as a fraction of the grid's side. Normalized because a deduction travels one
 * run per sweep, so a larger grid needs more sweeps to say the same thing; calibrated against measured
 * counts at each offered size so all three bands are reachable there.
 */
const EASY_FRACTION = 0.55;
const HARD_FRACTION = 0.85;

/**
 * One go around the grid: every run looked at once, in order. The measure lives here rather than in
 * the solver because it is the measure; the engine's worklist is faster but nothing like what a person
 * does, and a sweep is what a person does.
 */
function sweep(domains, runs) {
    let changed = false;

    for (const run of runs) {
        const { ok, supported } = analyseRun(domains, run);
        if (!ok) return { ok: false, changed };

        for (let step = 0; step < run.cells.length; step += 1) {
            const cell = run.cells[step];
            const narrowed = domains[cell] & supported[step];
            if (narrowed === 0) return { ok: false, changed };
            if (narrowed === domains[cell]) continue;
            domains[cell] = narrowed;
            changed = true;
        }
    }

    return { ok: true, changed };
}

/** Whether every open square has been narrowed to one digit. */
function isSettled(domains) {
    for (const mask of domains) {
        if (mask !== 0 && (mask & (mask - 1)) !== 0) return false;
    }
    return true;
}

/**
 * Rates a kakuro by how far the rules alone get, and how long they take about it.
 *
 * @param {object} puzzle - The puzzle to rate.
 * @param {object[]} puzzle.runs - Its runs, each carrying its sum.
 * @param {Uint8Array} puzzle.white - One entry per cell, 1 for an open square.
 * @param {Uint8Array|null} [puzzle.pinned] - Printed digits per cell, which make a grid easier and
 *   are therefore rated as part of it.
 * @returns {string} One of DIFFICULTY_ORDER.
 */
export function rateKakuro({ runs, white, pinned = null }) {
    const side = Math.round(Math.sqrt(white.length));
    const domains = initialDomains(white, pinned);
    let passes = 0;

    for (;;) {
        const { ok, changed } = sweep(domains, runs);
        if (!ok) return 'hard';
        if (!changed) break;
        passes += 1;
    }

    if (!isSettled(domains)) return 'hard';
    if (passes <= side * EASY_FRACTION) return 'easy';
    return passes <= side * HARD_FRACTION ? 'medium' : 'hard';
}
