/**
 * Difficulty rating by the techniques a logical solver needs (design-spec.md §8): rating is a
 * property of the puzzle, not the clue count. Only the techniques below are implemented; anything
 * beyond them rates hard.
 */

import { createDims } from './solver.js';

/** Difficulty labels, ordered easiest first. */
export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

/** Builds the row, column, and region unit index lists for a grid. */
function buildUnits(dims) {
    const { n, boxOf } = dims;
    const rows = Array.from({ length: n }, () => []);
    const cols = Array.from({ length: n }, () => []);
    const boxes = Array.from({ length: n }, () => []);

    for (let idx = 0; idx < n * n; idx += 1) {
        rows[Math.floor(idx / n)].push(idx);
        cols[idx % n].push(idx);
        boxes[boxOf[idx]].push(idx);
    }

    return { rows, cols, boxes, all: [...rows, ...cols, ...boxes] };
}

/** Builds each cell's peer list: every cell sharing a row, column, or region with it. */
function buildPeers(dims, units) {
    const { n, boxOf } = dims;
    return Array.from({ length: n * n }, (_unused, idx) => {
        const peers = new Set([
            ...units.rows[Math.floor(idx / n)],
            ...units.cols[idx % n],
            ...units.boxes[boxOf[idx]],
        ]);
        peers.delete(idx);
        return [...peers];
    });
}

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

/**
 * Working state for a rating run: the grid, per-cell candidates, and precomputed unit and peer
 * lookups.
 */
function createState(cells, dims) {
    const units = buildUnits(dims);
    const peers = buildPeers(dims, units);
    const candidates = new Int32Array(dims.n * dims.n);

    for (let idx = 0; idx < cells.length; idx += 1) {
        if (cells[idx] !== 0) continue;
        let used = 0;
        for (const peer of peers[idx]) {
            if (cells[peer] !== 0) used |= 1 << (cells[peer] - 1);
        }
        candidates[idx] = dims.full & ~used;
    }

    return { cells: Uint8Array.from(cells), candidates, units, peers, dims };
}

/** Writes a value into a cell and removes it from every peer's candidates. */
function assign(state, idx, value) {
    state.cells[idx] = value;
    state.candidates[idx] = 0;
    const bit = 1 << (value - 1);
    for (const peer of state.peers[idx]) {
        state.candidates[peer] &= ~bit;
    }
}

/** Places every cell with exactly one candidate, and every value with one home in a unit. */
function applySingles(state) {
    let progress = false;

    for (let idx = 0; idx < state.cells.length; idx += 1) {
        if (state.cells[idx] === 0 && popCount(state.candidates[idx]) === 1) {
            assign(state, idx, soleValue(state.candidates[idx]));
            progress = true;
        }
    }

    for (const unit of state.units.all) {
        for (let value = 1; value <= state.dims.n; value += 1) {
            const bit = 1 << (value - 1);
            let home = -1;
            let count = 0;
            for (const idx of unit) {
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

/** Every combination of size entries from a list, as index tuples. */
function combinations(items, size) {
    if (size > items.length) return [];
    const result = [];
    const pick = (start, chosen) => {
        if (chosen.length === size) {
            result.push([...chosen]);
            return;
        }
        for (let i = start; i < items.length; i += 1) {
            chosen.push(items[i]);
            pick(i + 1, chosen);
            chosen.pop();
        }
    };
    pick(0, []);
    return result;
}

/**
 * Naked pairs and triples: k cells in a unit whose candidates together span only k values own
 * those values, so no other cell in the unit can hold them.
 */
function applyNakedSubsets(state, maxSize) {
    let progress = false;

    for (const unit of state.units.all) {
        const open = unit.filter((idx) => state.cells[idx] === 0);
        for (let size = 2; size <= maxSize; size += 1) {
            for (const group of combinations(open, size)) {
                let union = 0;
                for (const idx of group) union |= state.candidates[idx];
                if (popCount(union) !== size) continue;
                progress = eliminate(state, unit, group, union) || progress;
            }
        }
    }

    return progress;
}

/**
 * Hidden pairs and triples: k values in a unit that between them can only go in k cells own
 * those cells, so every other candidate in them is impossible.
 */
function applyHiddenSubsets(state, maxSize) {
    const { n } = state.dims;
    let progress = false;

    for (const unit of state.units.all) {
        const open = unit.filter((idx) => state.cells[idx] === 0);
        const homesByValue = new Map();
        for (let value = 1; value <= n; value += 1) {
            const bit = 1 << (value - 1);
            const homes = open.filter((idx) => state.candidates[idx] & bit);
            if (homes.length >= 2) homesByValue.set(value, homes);
        }

        const values = [...homesByValue.keys()];
        for (let size = 2; size <= maxSize; size += 1) {
            for (const group of combinations(values, size)) {
                const cells = new Set();
                let mask = 0;
                for (const value of group) {
                    homesByValue.get(value).forEach((idx) => cells.add(idx));
                    mask |= 1 << (value - 1);
                }
                if (cells.size !== size) continue;
                for (const idx of cells) {
                    const before = state.candidates[idx];
                    state.candidates[idx] &= mask;
                    if (state.candidates[idx] !== before) progress = true;
                }
            }
        }
    }

    return progress;
}

/**
 * Removes candidates using pointing pairs and box-line reduction: when a value is confined to one
 * row or column inside a region, it leaves the rest of that line, and vice versa.
 */
function applyPointing(state) {
    const { n, boxOf } = state.dims;
    let progress = false;

    for (let value = 1; value <= n; value += 1) {
        const bit = 1 << (value - 1);

        for (const box of state.units.boxes) {
            const homes = box.filter(
                (idx) => state.cells[idx] === 0 && state.candidates[idx] & bit,
            );
            if (homes.length < 2) continue;

            const rows = new Set(homes.map((idx) => Math.floor(idx / n)));
            const cols = new Set(homes.map((idx) => idx % n));
            if (rows.size === 1) {
                progress = eliminate(state, state.units.rows[[...rows][0]], homes, bit) || progress;
            }
            if (cols.size === 1) {
                progress = eliminate(state, state.units.cols[[...cols][0]], homes, bit) || progress;
            }
        }

        for (const line of [...state.units.rows, ...state.units.cols]) {
            const homes = line.filter(
                (idx) => state.cells[idx] === 0 && state.candidates[idx] & bit,
            );
            if (homes.length < 2) continue;
            const boxes = new Set(homes.map((idx) => boxOf[idx]));
            if (boxes.size === 1) {
                progress =
                    eliminate(state, state.units.boxes[[...boxes][0]], homes, bit) || progress;
            }
        }
    }

    return progress;
}

/** Clears candidate bits from every cell in a unit except the ones the deduction came from. */
function eliminate(state, unit, keep, mask) {
    let progress = false;
    for (const idx of unit) {
        if (keep.includes(idx) || state.cells[idx] !== 0) continue;
        const before = state.candidates[idx];
        state.candidates[idx] &= ~mask;
        if (state.candidates[idx] !== before) progress = true;
    }
    return progress;
}

/**
 * Rates a puzzle by the hardest technique a logical solver needs to finish it.
 *
 * @param {Uint8Array} cells - The puzzle grid, 0 for empty. Not mutated.
 * @param {number} n - Grid side length.
 * @returns {string} 'easy' (singles only), 'medium' (needs naked or hidden subsets, or
 *   pointing), or 'hard' (needs a technique beyond those, such as an X-wing, or none of them
 *   finish it).
 */
export function rate(cells, n) {
    const state = createState(cells, createDims(n));
    let usedMedium = false;

    for (;;) {
        if (applySingles(state)) continue;
        if (applyNakedSubsets(state, 3) || applyHiddenSubsets(state, 3) || applyPointing(state)) {
            usedMedium = true;
            continue;
        }
        break;
    }

    const solved = state.cells.every((value) => value !== 0);
    if (!solved) return 'hard';
    return usedMedium ? 'medium' : 'easy';
}
