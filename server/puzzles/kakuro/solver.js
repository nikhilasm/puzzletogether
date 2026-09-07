/**
 * What a kakuro's rules imply: which digits each square can still hold, which sums each clue could
 * still take, and how far short of one answer the grid is. A run is analysed exactly, a forward pass
 * for reachable states and a backward pass for completable ones, so a digit survives in a square only
 * if some legal filling puts it there, which is what lets runs stay long (ADR-0015).
 */

import { indexRuns, MAX_RUN } from './runs.js';

/** The candidate set holding every digit, as a 9-bit mask over 1 to 9. */
export const FULL = 0x1ff;

/** Bitmask for one digit. */
function bit(digit) {
    return 1 << (digit - 1);
}

/** How many digits a candidate mask allows. */
function popCount(mask) {
    let count = 0;
    for (let bits = mask; bits !== 0; bits &= bits - 1) count += 1;
    return count;
}

/** The single digit a one-candidate mask allows. */
function soleDigit(mask) {
    return Math.log2(mask) + 1;
}

/** What each set of digits adds up to, so a state's sum is a lookup rather than a loop. */
const SET_SUM = (() => {
    const sums = new Int32Array(512);
    for (let mask = 1; mask < 512; mask += 1) {
        const lowest = mask & -mask;
        sums[mask] = sums[mask ^ lowest] + soleDigit(lowest);
    }
    return sums;
})();

/**
 * Scratch buffers for the run analysis, reused across calls. Allocated once because this runs tens of
 * millions of times for one 13×13, and per-call allocation was the single largest cost in the first
 * profile; nothing outside analyseRun may hold a reference to them.
 */
const SCRATCH = {
    layers: Array.from({ length: MAX_RUN + 1 }, () => new Int32Array(512)),
    sizes: new Int32Array(MAX_RUN + 1),
    seen: new Uint8Array(512),
    good: new Uint8Array(512),
    next: new Uint8Array(512),
    supported: new Int32Array(MAX_RUN),
};

/**
 * Everything one run's own rules say, given what its squares can currently hold.
 *
 * @param {Int32Array} domains - Candidate mask per cell.
 * @param {{ cells: number[], sum: number|null }} run - The run, whose sum may not be chosen yet.
 * @param {boolean} [wantSums] - Also collect the sums this clue could still take, which only the
 *   generator asks for.
 * @returns {{ ok: boolean, supported: Int32Array, sums: number[]|null }} Whether the run can be
 *   filled at all, the digits each of its squares can hold in some legal filling, and the sums it
 *   could carry. supported is scratch and is only valid until the next call.
 */
export function analyseRun(domains, run, wantSums = false) {
    const cells = run.cells;
    const length = cells.length;
    const { layers, sizes, seen, supported } = SCRATCH;

    layers[0][0] = 0;
    sizes[0] = 1;

    for (let step = 0; step < length; step += 1) {
        const domain = domains[cells[step]];
        const from = layers[step];
        const into = layers[step + 1];
        let count = 0;

        for (let i = 0; i < sizes[step]; i += 1) {
            const state = from[i];
            let available = domain & ~state;
            while (available !== 0) {
                const lowest = available & -available;
                available ^= lowest;
                const reached = state | lowest;
                if (seen[reached]) continue;
                seen[reached] = 1;
                into[count] = reached;
                count += 1;
            }
        }

        sizes[step + 1] = count;
        for (let i = 0; i < count; i += 1) seen[into[i]] = 0;
        if (count === 0) return { ok: false, supported, sums: null };
    }

    const sums = wantSums ? [] : null;
    let good = SCRATCH.good;
    let next = SCRATCH.next;
    let ends = 0;

    good.fill(0);
    for (let i = 0; i < sizes[length]; i += 1) {
        const state = layers[length][i];
        if (run.sum != null && SET_SUM[state] !== run.sum) continue;
        good[state] = 1;
        ends += 1;
        if (sums && !sums.includes(SET_SUM[state])) sums.push(SET_SUM[state]);
    }

    if (ends === 0) return { ok: false, supported, sums };

    for (let step = length - 1; step >= 0; step -= 1) {
        const domain = domains[cells[step]];
        next.fill(0);
        supported[step] = 0;

        for (let i = 0; i < sizes[step]; i += 1) {
            const state = layers[step][i];
            let available = domain & ~state;
            while (available !== 0) {
                const lowest = available & -available;
                available ^= lowest;
                if (!good[state | lowest]) continue;
                next[state] = 1;
                supported[step] |= lowest;
            }
        }

        const swap = good;
        good = next;
        next = swap;
    }

    SCRATCH.good = good;
    SCRATCH.next = next;
    return { ok: true, supported, sums };
}

/**
 * The sums a clue with no value yet could still take.
 *
 * @param {Int32Array} domains - Candidate mask per cell.
 * @param {{ cells: number[], sum: number|null }} run - The run to price.
 * @returns {number[]} Every sum some legal filling of the run adds up to, ascending.
 */
export function feasibleSums(domains, run) {
    const { ok, sums } = analyseRun(domains, run, true);
    return ok ? sums.sort((first, second) => first - second) : [];
}

/**
 * Narrows every square's candidates until nothing more follows. A worklist rather than repeated
 * sweeps, so narrowing one run enqueues only the runs crossing it; a run with no sum yet still
 * constrains, since its digits are distinct however they add up, which is what narrows a half-clued
 * board at all.
 *
 * @param {Int32Array} domains - Candidate mask per cell, narrowed in place. Zero at a block.
 * @param {object[]} runs - The puzzle's runs.
 * @param {({ across: object, down: object }|null)[]} index - The two runs each square belongs to.
 * @param {object[]} [seed] - Runs to start from, when the caller knows the rest of the board is
 *   already settled against itself and only one clue has changed. Defaults to every run.
 * @returns {boolean} False when the grid contradicts itself.
 */
export function narrow(domains, runs, index, seed = runs) {
    const queue = [...seed];
    const queued = new Set(queue);

    while (queue.length > 0) {
        const run = queue.pop();
        queued.delete(run);

        const { ok, supported } = analyseRun(domains, run);
        if (!ok) return false;

        for (let step = 0; step < run.cells.length; step += 1) {
            const cell = run.cells[step];
            const narrowed = domains[cell] & supported[step];
            if (narrowed === 0) return false;
            if (narrowed === domains[cell]) continue;
            domains[cell] = narrowed;

            // Only the crossing run can learn from this square; the run just analysed is already
            // consistent with everything it had to say.
            const crossing = index[cell].across === run ? index[cell].down : index[cell].across;
            if (!queued.has(crossing)) {
                queued.add(crossing);
                queue.push(crossing);
            }
        }
    }

    return true;
}

/**
 * How far the grid is from having one answer: the product of what every square could still hold. One
 * means settled and settled means unique; returned as a logarithm because the product overflows long
 * before it becomes interesting, and only its ordering is ever used.
 *
 * @param {Int32Array} domains - Candidate mask per cell.
 * @returns {number} Zero when exactly one answer remains, larger the looser the grid is.
 */
export function ambiguity(domains) {
    let total = 0;
    for (const mask of domains) {
        if (mask !== 0) total += Math.log2(popCount(mask));
    }
    return total;
}

/**
 * The starting candidates for a puzzle: every digit in each open square, and one digit in each
 * square the puzzle has printed.
 *
 * @param {Uint8Array} white - One entry per cell, 1 for an open square.
 * @param {Uint8Array|null} [pinned] - Printed digits per cell, 0 where the square is the player's.
 * @returns {Int32Array} Candidate mask per cell.
 */
export function initialDomains(white, pinned = null) {
    const domains = new Int32Array(white.length);
    for (let idx = 0; idx < white.length; idx += 1) {
        if (!white[idx]) continue;
        domains[idx] = pinned?.[idx] ? bit(pinned[idx]) : FULL;
    }
    return domains;
}

/** A settled grid as digits, which is the shape generation and the document both want. */
function toGrid(domains) {
    const grid = new Uint8Array(domains.length);
    for (let idx = 0; idx < domains.length; idx += 1) {
        if (domains[idx] !== 0) grid[idx] = soleDigit(domains[idx]);
    }
    return grid;
}

/**
 * How many squares the search may settle before it gives up on the question.
 *
 * Only the independent verification in the tests takes this path now: generation settles a grid by
 * narrowing, and a narrowed grid needs no search. It is bounded anyway, because proving a *unique*
 * answer means exhausting the tree, and an under-constrained grid can make that tree very large.
 */
const NODE_BUDGET = 20000;

/** Depth-first search from the most constrained square, collecting solutions until limit are found. */
function search(domains, runs, limit, solutions, state) {
    state.nodes += 1;
    if (state.nodes > state.budget) {
        state.cut = true;
        return true;
    }

    if (!narrow(domains, runs, state.index)) return false;

    let target = -1;
    let fewest = MAX_RUN + 1;
    for (let idx = 0; idx < domains.length; idx += 1) {
        const count = popCount(domains[idx]);
        if (count < 2 || count >= fewest) continue;
        fewest = count;
        target = idx;
    }

    if (target === -1) {
        solutions.push(toGrid(domains));
        return solutions.length >= limit;
    }

    for (let digit = 1; digit <= 9; digit += 1) {
        if ((domains[target] & bit(digit)) === 0) continue;
        const branch = Int32Array.from(domains);
        branch[target] = bit(digit);
        if (search(branch, runs, limit, solutions, state)) return true;
    }

    return false;
}

/**
 * Solves a kakuro, stopping once limit answers have been found. complete is not the same as
 * answers.length: a search that ran out of budget proved nothing, so one answer with complete false
 * means "could not tell" rather than "unique", and every caller has to read both.
 *
 * @param {object} puzzle - The puzzle to solve.
 * @param {object[]} puzzle.runs - Its runs, each carrying its sum.
 * @param {Uint8Array} puzzle.white - One entry per cell, 1 for an open square.
 * @param {Uint8Array|null} [puzzle.pinned] - Printed digits per cell, 0 where the square is open.
 * @param {number} [limit] - Stop once this many answers are found.
 * @returns {{ answers: Uint8Array[], complete: boolean }} The answers found, at most limit of them,
 *   and whether the search finished rather than running out of budget.
 */
export function solveKakuro({ runs, white, pinned = null }, limit = 2) {
    const answers = [];
    const state = {
        nodes: 0,
        budget: NODE_BUDGET,
        cut: false,
        index: indexRuns(runs, white.length),
    };
    search(initialDomains(white, pinned), runs, limit, answers, state);
    return { answers, complete: !state.cut };
}

/**
 * The first square two answers to the same puzzle disagree on.
 *
 * @param {Uint8Array} first - One answer.
 * @param {Uint8Array} second - Another answer to the same puzzle.
 * @returns {number} Flat cell index, or -1 when the two are identical.
 */
export function firstDisagreement(first, second) {
    for (let idx = 0; idx < first.length; idx += 1) {
        if (first[idx] !== second[idx]) return idx;
    }
    return -1;
}

/** The settled grid, for a board narrowing has taken all the way down. */
export function answerFrom(domains) {
    return toGrid(domains);
}
