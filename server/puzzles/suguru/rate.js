/**
 * Difficulty rating by how much work two logical rules do before a solver has to guess
 * (design-spec.md §8), the same measured-not-requested approach nonogram and kakuro take.
 *
 * **Naked singles carries both of the design's first two named deductions.** A cell whose
 * candidates have narrowed to one is forced whether that narrowing came from a geometric neighbour
 * or from a region-mate, since both are peers in solver.js's sense; there is no separate "region's
 * one remaining empty cell" rule to write, because the moment a region has one cell left, that
 * cell's region-mates, all of them peers, have already struck every other value from it. The third
 * rule, a digit confined to one legal cell in its region even though that cell still has other
 * candidates, is not something peer-pruning alone ever finds, so it is the one written out below.
 *
 * **Every generated suguru is required to settle by these two rules alone.** A grid the rules
 * cannot finish rates hard rather than failing generation, the same guarantee kakuro makes for
 * itself: the case is kept because a hand-made puzzle could still arrive unsettled, not because this
 * generator ever produces one.
 */

import { buildPeers } from './solver.js';

/** Difficulty labels, ordered easiest first. */
export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

/**
 * Where the bands sit, as a fraction of the grid's side.
 *
 * Normalized the way kakuro's and nonogram's thresholds are: a deduction travels one region or one
 * neighbourhood at a time, so a larger grid needs more sweeps to say the same thing.
 */
const EASY_FRACTION = 0.5;
const HARD_FRACTION = 0.85;

/** Counts the set bits in a candidate mask. */
function popCount(mask) {
    let count = 0;
    for (let bits = mask; bits !== 0; bits &= bits - 1) count += 1;
    return count;
}

/** The single value a one-candidate mask allows. */
function soleValue(mask) {
    return Math.log2(mask) + 1;
}

/** Working state for a rating run: the grid, its candidates, and the fixed peer structure. */
function createState(cells, regions, n) {
    const { peers, sizeOf } = buildPeers(regions, n);
    const candidates = new Int32Array(n * n);

    for (let idx = 0; idx < cells.length; idx += 1) {
        candidates[idx] = cells[idx] === 0 ? (1 << sizeOf[idx]) - 1 : 0;
    }
    for (let idx = 0; idx < cells.length; idx += 1) {
        if (cells[idx] === 0) continue;
        const bit = 1 << (cells[idx] - 1);
        for (const peer of peers[idx]) candidates[peer] &= ~bit;
    }

    return { cells: Uint8Array.from(cells), candidates, peers, regions };
}

/** Writes a value into a cell and strikes it from every peer's candidates. */
function assign(state, idx, value) {
    state.cells[idx] = value;
    state.candidates[idx] = 0;
    const bit = 1 << (value - 1);
    for (const peer of state.peers[idx]) state.candidates[peer] &= ~bit;
}

/** Places every cell narrowed to one candidate, from adjacency or from its region running out. */
function applyNakedSingles(state) {
    let progress = false;
    for (let idx = 0; idx < state.cells.length; idx += 1) {
        if (state.cells[idx] === 0 && popCount(state.candidates[idx]) === 1) {
            assign(state, idx, soleValue(state.candidates[idx]));
            progress = true;
        }
    }
    return progress;
}

/** Places a digit that has exactly one legal cell left in its region. */
function applyRegionHiddenSingles(state) {
    let progress = false;

    for (const region of state.regions) {
        for (let value = 1; value <= region.cells.length; value += 1) {
            const bit = 1 << (value - 1);
            let home = -1;
            let count = 0;
            for (const idx of region.cells) {
                if (state.cells[idx] === value) {
                    count = 0;
                    break;
                }
                if (state.cells[idx] === 0 && state.candidates[idx] & bit) {
                    home = idx;
                    count += 1;
                }
            }
            if (count === 1) {
                assign(state, home, value);
                progress = true;
            }
        }
    }

    return progress;
}

/**
 * Rates a suguru by how many sweeps its two rules need to settle it.
 *
 * @param {object} puzzle - The puzzle to rate.
 * @param {Uint8Array} puzzle.cells - The grid, 0 for empty, given values filled in.
 * @param {{ id: number, cells: number[] }[]} puzzle.regions - The puzzle's regions.
 * @param {number} puzzle.n - Grid side length.
 * @returns {string} One of DIFFICULTY_ORDER.
 */
export function rateSuguru({ cells, regions, n }) {
    const state = createState(cells, regions, n);
    let passes = 0;

    while (applyNakedSingles(state) || applyRegionHiddenSingles(state)) passes += 1;

    const solved = state.cells.every((value) => value !== 0);
    if (!solved) return 'hard';
    if (passes <= n * EASY_FRACTION) return 'easy';
    return passes <= n * HARD_FRACTION ? 'medium' : 'hard';
}
