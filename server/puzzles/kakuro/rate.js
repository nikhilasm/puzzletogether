/**
 * Difficulty rating by how much work the rules do before a solver has to guess (design-spec.md §8).
 *
 * Measured rather than asked for, by the same propagator that proves the puzzle fair, which is
 * nonogram's argument rather than kenken's: sweeping the runs until nothing more follows is what a
 * person does, so how many sweeps it took is a property of the puzzle.
 *
 * - **easy**: the rules settle the grid quickly.
 * - **medium**: they settle it, but it takes longer, which is a grid where a deduction in one corner
 *   is what opens the next one somewhere else.
 * - **hard**: it takes longer still, or the rules do not settle it at all and a solver has to suppose
 *   a digit and see what follows.
 *
 * **Nothing this generator ships needs supposing.** It builds a puzzle by narrowing until the grid is
 * settled, so a grid it hands over is one the rules finish; the unsettled case is kept because a
 * banked or hand-made puzzle could still arrive that way, and because a rating that cannot express
 * "harder than the rules" would be lying about what it measured.
 *
 * **The first draft had a fourth idea and it was empty.** Rating "easy" as what falls to the clue's
 * own decomposition alone, without using what the grid has already ruled out, described no puzzle
 * this generator has ever produced: 144 measured across four sizes, and not one settled that way.
 * A band nothing lands in is not a difficulty, so the ladder is one measure with a threshold on it.
 */

import { analyseRun, initialDomains } from './solver.js';

/** Difficulty labels, ordered easiest first. */
export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

/**
 * Where the bands sit, as a fraction of the grid's side.
 *
 * Normalized the way nonogram's thresholds are, and for the same reason: a deduction travels one run
 * at a time, so a larger grid needs more sweeps to say the same thing. An earlier version of this
 * file used a flat threshold and said so, on the grounds that runs were two to four squares whatever
 * the size. That was true of the generator that wrote it and is not true now: runs average four or
 * more, sweeps run from 3 at a 9×9 to 22 at a 13×13, and a flat line through that would call every
 * large puzzle hard.
 *
 * Calibrated against measured counts at each offered size, so that all three bands are reachable at
 * all of them: the run-length ceiling generation uses per difficulty moves the distribution, and
 * these are where it separates.
 */
const EASY_FRACTION = 0.55;
const HARD_FRACTION = 0.85;

/**
 * One go around the grid: every run looked at once, in order.
 *
 * The measure lives here rather than in the solver because it *is* the measure. The engine narrows
 * with a worklist, revisiting only the runs that could have learned something, which is faster and
 * is nothing like what a person does. A sweep is what a person does.
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
