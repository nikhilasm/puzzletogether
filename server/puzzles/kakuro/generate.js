/**
 * Kakuro generation: draw a layout, then choose its clues, each one for how much it settles the grid
 * (design-spec.md §8). The clues are the puzzle, so nothing is filled in; a solver narrows what each
 * square could hold, and each clue is picked for how much it narrows the whole board (ADR-0015).
 */

import {
    ambiguity,
    answerFrom,
    feasibleSums,
    initialDomains,
    narrow,
    solveKakuro,
} from './solver.js';
import { drawLayout, isConnected, partnerOf } from './layout.js';
import { rateKakuro, DIFFICULTY_ORDER } from './rate.js';
import { deriveRuns, hasNoShortRun, indexRuns, MAX_RUN, MIN_RUN } from './runs.js';

/**
 * How many boards to build before settling for the nearest one to the difficulty asked for. Every
 * attempt produces a fair puzzle, so this budgets for hitting the rating; the wall clock below is
 * what actually stops it at the larger sizes.
 */
const MAX_RESTARTS = 40;

/**
 * Wall-clock ceiling on the search for a puzzle at the difficulty asked for. Generation runs in a
 * worker thread against a pre-warmed pool, so this bounds CPU per puzzle rather than a latency a
 * player waits on.
 */
const TIME_BUDGET_MS = 4000;

/**
 * Longest run any layout may contain. One number for every difficulty, since the grid's own width
 * caps it and density carries the layout half of difficulty instead; not raised past 8 because at 9
 * the repair blocks so many squares that a large grid shrinks to a small puzzle.
 */
const RUN_LIMIT = 8;

/**
 * Share of the interior each difficulty blocks out. Every block shortens two runs, so this and run
 * length are one dial seen from two sides; calibrated against rate.js within the 20 to 30 per cent a
 * printed kakuro carries.
 */
const BLOCK_DENSITY = { easy: 0.3, medium: 0.24, hard: 0.2 };

/**
 * How much denser each rung of the fallback ladder draws, and where the ladder stops. The ceiling is
 * the point past which the grid stops being a puzzle and starts being a frame, so a request that
 * cannot be met inside it is better met by printing a digit.
 */
const DENSITY_STEP = 0.04;
const MAX_DENSITY = 0.44;

/** How many values to weigh for one clue, and how many pairs when re-choosing a crossing. */
const VALUES_TRIED = 8;
const PAIRS_TRIED = 24;

/** How many options to keep per overlap size in the crossing table, and how many to try per square. */
const PAIRS_PER_GROUP = 120;
const SEEDS_TRIED = 12;

/**
 * How far down the ranking of candidate clue values each difficulty reaches, from 0 for the most
 * constraining to 1 for the least. The second difficulty knob, working where run length cannot: a
 * narrow interior gives every difficulty the same run ceiling, so without this the three levels were
 * the same puzzle drawn three times.
 */
const CLUE_REACH = { easy: 0, medium: 0.5, hard: 1 };

/** How many layouts to try at each shortened run length, once the wanted one has not worked out. */
const RELAXED_ATTEMPTS = 6;

/** How many repair rounds to attempt before the layout is written off and redrawn. */
const REPAIR_ROUNDS = 40;

/** Every digit any run of a given length and sum could use, which is what seeds a crossing. */
const DIGIT_UNION = (() => {
    const table = Array.from({ length: MAX_RUN + 1 }, () => new Int32Array(46));
    for (let mask = 1; mask < 512; mask += 1) {
        let length = 0;
        let sum = 0;
        for (let digit = 1; digit <= 9; digit += 1) {
            if (mask & (1 << (digit - 1))) {
                length += 1;
                sum += digit;
            }
        }
        table[length][sum] |= mask;
    }
    return table;
})();

/**
 * Clue pairs for a crossing, grouped by how few digits the two clues leave it, tightest first.
 * Grouped rather than reduced to the single best because seeding is a preference: a board where every
 * crossing takes the hardest pair usually contradicts itself, so it falls back a group at a time.
 */
const CROSSING_PAIRS = (() => {
    const table = Array.from({ length: MAX_RUN + 1 }, () => new Array(MAX_RUN + 1).fill(null));

    for (let across = MIN_RUN; across <= MAX_RUN; across += 1) {
        for (let down = MIN_RUN; down <= MAX_RUN; down += 1) {
            const groups = [[], [], []];

            for (let sa = 1; sa <= 45; sa += 1) {
                if (DIGIT_UNION[across][sa] === 0) continue;
                for (let sd = 1; sd <= 45; sd += 1) {
                    if (DIGIT_UNION[down][sd] === 0) continue;

                    let size = 0;
                    for (let bits = DIGIT_UNION[across][sa] & DIGIT_UNION[down][sd]; bits !== 0;) {
                        bits &= bits - 1;
                        size += 1;
                    }
                    if (size < 1 || size > groups.length) continue;
                    if (groups[size - 1].length < PAIRS_PER_GROUP) groups[size - 1].push([sa, sd]);
                }
            }

            table[across][down] = groups;
        }
    }

    return table;
})();

/**
 * The longest run this grid may hold, the smaller of the limit and what the grid can cut. A run
 * spanning the whole interior is never split, leaving one open block no clue-choosing can settle, so
 * the limit is held below the interior's width.
 */
function limitFor(n) {
    return Math.min(RUN_LIMIT, n - 3);
}

/** A board under construction: its layout, its runs (some without values yet), and what it implies. */
function newBoard(white, n) {
    const runs = deriveRuns(white, n);
    for (const run of runs) run.sum = null;
    return { white, n, runs, index: indexRuns(runs, white.length), domains: null };
}

/** Re-derives what the chosen clues imply, from nothing. Used after any clue is taken back. */
function reduce(board) {
    const domains = initialDomains(board.white);
    const ok = narrow(domains, board.runs, board.index);
    board.domains = domains;
    return ok;
}

/**
 * Whether the across clues and the down clues can still add up to the same total. Both totals count
 * every digit once, so holding a clue to that as it is chosen is the cheapest global constraint
 * there is, refusing values that would otherwise be found out only at the very end.
 */
function totalsCanMeet(runs, open) {
    const span = { A: [0, 0], D: [0, 0] };

    for (const run of runs) {
        const side = span[run.dir];
        if (run.sum != null) {
            side[0] += run.sum;
            side[1] += run.sum;
            continue;
        }
        const sums = open.get(run);
        if (!sums || sums.length === 0) return false;
        side[0] += sums[0];
        side[1] += sums[sums.length - 1];
    }

    return span.A[0] <= span.D[1] && span.D[0] <= span.A[1];
}

/** The sums each unvalued clue could still take, which both the picker and the totals rule want. */
function openValues(board) {
    const open = new Map();
    for (const run of board.runs) {
        if (run.sum != null) continue;
        const sums = feasibleSums(board.domains, run);
        if (sums.length === 0) return null;
        open.set(run, sums);
    }
    return open;
}

/**
 * Tries a value on a clue and reports what the whole board would look like, or null if it breaks.
 */
function weigh(board, run, value) {
    const previous = run.sum;
    run.sum = value;

    // Seeded from the one clue that changed: choosing a value only ever narrows, and the rest of the
    // board is already consistent, so a full pass would find nothing.
    const domains = Int32Array.from(board.domains);
    const ok = narrow(domains, board.runs, board.index, [run]);
    run.sum = previous;

    return ok ? { domains, score: ambiguity(domains) } : null;
}

/**
 * Seeds the crossings: where neither clue through a square is chosen, take a pair that pins that
 * square hard. A crossing that will not take any pair is left alone rather than failing the board,
 * since step 3 chooses for it; seeding is an optimisation and may decline.
 */
function seedCrossings(board, rng) {
    for (let idx = 0; idx < board.white.length; idx += 1) {
        const crossing = board.index[idx];
        if (!crossing || crossing.across.sum != null || crossing.down.sum != null) continue;

        const groups = CROSSING_PAIRS[crossing.across.cells.length][crossing.down.cells.length];
        let tried = 0;

        for (const group of groups) {
            for (const [sa, sd] of rng.shuffle([...group])) {
                if (tried >= SEEDS_TRIED) break;
                tried += 1;

                crossing.across.sum = sa;
                crossing.down.sum = sd;
                const domains = Int32Array.from(board.domains);
                if (narrow(domains, board.runs, board.index, [crossing.across, crossing.down])) {
                    board.domains = domains;
                    tried = SEEDS_TRIED + 1;
                    break;
                }
                crossing.across.sum = null;
                crossing.down.sum = null;
            }
            if (tried > SEEDS_TRIED) break;
        }
    }

    return true;
}

/**
 * Chooses every remaining clue, loosest first, each for how much it settles the board. The clue with
 * the most values still open carries the most uncertainty, so deciding it is worth more than one that
 * was nearly pinned already.
 */
function chooseClues(board, rng, reach = 0) {
    for (;;) {
        const open = openValues(board);
        if (!open) return false;
        if (open.size === 0) return true;
        if (!totalsCanMeet(board.runs, open)) return false;

        // Loosest first, but a clue that cannot be decided is not a dead end: another clue may still
        // be decidable, and deciding it narrows the one that was stuck.
        const order = [...open.keys()].sort(
            (first, second) => open.get(second).length - open.get(first).length,
        );

        let taken = false;
        for (const run of order) {
            const best = bestValue(board, run, open, rng, reach);
            if (!best) continue;
            run.sum = best.value;
            board.domains = best.domains;
            taken = true;
            break;
        }

        if (!taken) return false;
    }
}

/**
 * The value to give one clue, chosen for how much of the board it settles. Which end of that ranking
 * to take is the difficulty knob: the most constraining value makes an easy puzzle, a looser one
 * leaves more for the solver, spread further across the grid.
 */
function bestValue(board, run, open, rng, reach) {
    const candidates = rng.shuffle([...open.get(run)]).slice(0, VALUES_TRIED);
    const viable = [];

    for (const value of candidates) {
        const others = new Map(open);
        others.delete(run);
        run.sum = value;
        const reachable = totalsCanMeet(board.runs, others);
        run.sum = null;
        if (!reachable) continue;

        const weighed = weigh(board, run, value);
        if (weighed) viable.push({ ...weighed, value });
    }

    if (viable.length === 0) return null;
    viable.sort((first, second) => first.score - second.score);
    return viable[Math.min(viable.length - 1, Math.round((viable.length - 1) * reach))];
}

/** Every square the board has not settled, which is where a repair has to act. */
function unsettled(board) {
    const cells = [];
    for (let idx = 0; idx < board.domains.length; idx += 1) {
        const mask = board.domains[idx];
        if (mask !== 0 && (mask & (mask - 1)) !== 0) cells.push(idx);
    }
    return cells;
}

/**
 * Re-chooses the two clues crossing an unsettled square, keeping the pair that settles the board
 * most. Preferred over blocking the square because it costs the puzzle nothing; only when no pair of
 * values helps is a square taken out.
 */
function rechooseCrossing(board, rng, current) {
    for (const idx of rng.shuffle(unsettled(board))) {
        const { across, down } = board.index[idx];
        const wasAcross = across.sum;
        const wasDown = down.sum;

        across.sum = null;
        down.sum = null;
        if (!reduce(board)) {
            across.sum = wasAcross;
            down.sum = wasDown;
            reduce(board);
            continue;
        }

        const acrossValues = feasibleSums(board.domains, across);
        const downValues = feasibleSums(board.domains, down);
        const pairs = [];
        for (const sa of acrossValues) {
            for (const sd of downValues) pairs.push([sa, sd]);
        }

        let best = null;
        for (const [sa, sd] of rng.shuffle(pairs).slice(0, PAIRS_TRIED)) {
            across.sum = sa;
            down.sum = sd;
            const domains = Int32Array.from(board.domains);
            const ok = narrow(domains, board.runs, board.index, [across, down]);
            across.sum = null;
            down.sum = null;
            if (!ok) continue;

            const score = ambiguity(domains);
            if (!best || score < best.score) best = { sa, sd, domains, score };
        }

        if (best && best.score < current) {
            across.sum = best.sa;
            down.sum = best.sd;
            board.domains = best.domains;
            return best.score;
        }

        across.sum = wasAcross;
        down.sum = wasDown;
        reduce(board);
    }

    return null;
}

/**
 * Blocks an unsettled square out of the grid, and re-chooses the clues that lost their runs. The move
 * of last resort, still better than printing a digit; the symmetric pair is offered first so the
 * pattern layout.js drew survives the repair (ADR-0016).
 */
function blockSquare(board, rng, current) {
    for (const idx of rng.shuffle(unsettled(board))) {
        const partner = partnerOf(idx, board.n);
        const attempts = board.white[partner] ? [[idx, partner], [idx]] : [[idx]];

        for (const squares of attempts) {
            const score = tryBlocking(board, rng, current, squares);
            if (score != null) return score;
        }
    }

    return null;
}

/**
 * Blocks a set of squares, re-chooses the clues whose runs changed, and keeps the result only if the
 * board came out less ambiguous than it went in. Clues on untouched runs are carried over by their
 * square list, so work already done is not thrown away.
 */
function tryBlocking(board, rng, current, squares) {
    const kept = new Map();
    for (const run of board.runs) {
        if (run.sum != null) kept.set(run.cells.join(','), run.sum);
    }

    for (const square of squares) board.white[square] = 0;

    if (hasNoShortRun(board.white, board.n) && isConnected(board.white, board.n)) {
        const runs = deriveRuns(board.white, board.n);
        for (const run of runs) run.sum = kept.get(run.cells.join(',')) ?? null;

        const trial = {
            ...board,
            runs,
            index: indexRuns(runs, board.white.length),
        };

        if (reduce(trial) && chooseClues(trial, rng) && ambiguity(trial.domains) < current) {
            board.runs = trial.runs;
            board.index = trial.index;
            board.domains = trial.domains;
            return ambiguity(trial.domains);
        }
    }

    for (const square of squares) board.white[square] = 1;
    return null;
}

/** Works at the board until it has one answer, or until nothing more is being learned. */
function repair(board, rng) {
    let current = ambiguity(board.domains);

    for (let round = 0; round < REPAIR_ROUNDS && current > 0; round += 1) {
        const improved = rechooseCrossing(board, rng, current) ?? blockSquare(board, rng, current);
        if (improved == null) return false;
        current = improved;
    }

    return current === 0;
}

/** One complete attempt: a layout, its clues, and whatever repair it needed. */
function buildBoard(n, { density, limit }, rng, reach = 0) {
    const white = drawLayout(n, { density, limit, rng });
    if (!white) return null;

    const board = newBoard(white, n);
    if (!reduce(board)) return null;
    if (!seedCrossings(board, rng)) return null;
    if (!chooseClues(board, rng, reach)) return null;
    if (ambiguity(board.domains) > 0 && !repair(board, rng)) return null;

    return board;
}

/** The shape the rest of the module expects, from a board narrowing has settled. */
function finish(board, givens = []) {
    return {
        white: board.white,
        runs: board.runs,
        solution: answerFrom(board.domains),
        givens,
        difficulty: rateKakuro(board),
    };
}

/**
 * Prints digits into a board that would not settle, which is what keeps generation total. Never
 * reached in measurement; the digits printed are an answer's own, so the board stays consistent.
 */
function printDigits(board) {
    const answer = solveKakuro(board, 1).answers[0];
    if (!answer) return null;

    const givens = [];
    const pinned = new Uint8Array(board.white.length);
    for (const idx of unsettled(board)) {
        pinned[idx] = answer[idx];
        givens.push(idx);
        const domains = initialDomains(board.white, pinned);
        narrow(domains, board.runs, board.index);
        board.domains = domains;
        if (ambiguity(domains) === 0) break;
    }

    return { ...finish(board, givens), solution: answer };
}

/** How far a rating sits from the one that was asked for, so a near miss can be preferred. */
function distance(rating, wanted) {
    return Math.abs(DIFFICULTY_ORDER.indexOf(rating) - DIFFICULTY_ORDER.indexOf(wanted));
}

/**
 * Generates a uniquely solvable kakuro at, or as close as possible to, the requested difficulty.
 *
 * @param {object} options - Generation options.
 * @param {string} options.difficulty - Requested difficulty; sets the ceiling on run length.
 * @param {number} options.n - Grid side length, counting the clue border.
 * @param {import('../rng.js').Rng} options.rng - Seeded generator.
 * @returns {{ white: Uint8Array, runs: object[], solution: Uint8Array, givens: number[],
 *   difficulty: string }} The layout, its runs carrying their sums, the answer, any squares that had
 *   to be printed, and the difficulty it measured at.
 * @throws {Error} If no layout could be drawn at all, which is a bug rather than bad luck.
 */
export function generateKakuro({ difficulty, n, rng }) {
    const started = Date.now();
    const limit = limitFor(n);
    const wanted = BLOCK_DENSITY[difficulty] ?? BLOCK_DENSITY.medium;
    let best = null;

    for (let attempt = 0; attempt < MAX_RESTARTS; attempt += 1) {
        const board = buildBoard(n, { density: wanted, limit }, rng, CLUE_REACH[difficulty] ?? 0);
        if (board) {
            const candidate = finish(board);
            if (candidate.difficulty === difficulty) return candidate;
            const nearer =
                !best ||
                distance(candidate.difficulty, difficulty) < distance(best.difficulty, difficulty);
            if (nearer) best = candidate;
        }

        if (Date.now() - started > TIME_BUDGET_MS) break;
    }

    if (best) return best;

    // Nothing settled at the density this difficulty asked for, so draw a blockier grid. Shorter runs
    // are easier to settle, the trade generation makes rather than failing: at worst an easier puzzle
    // than was ordered.
    for (let density = wanted + DENSITY_STEP; density <= MAX_DENSITY; density += DENSITY_STEP) {
        for (let attempt = 0; attempt < RELAXED_ATTEMPTS; attempt += 1) {
            const board = buildBoard(n, { density, limit }, rng);
            if (board) return finish(board);
        }
    }

    // Nothing settled at any density, so the grid is printed into instead. Not reached in any
    // measurement; kept because a generator that can throw is one a host can press a button and lose.
    for (let attempt = 0; attempt < RELAXED_ATTEMPTS; attempt += 1) {
        const white = drawLayout(n, { density: MAX_DENSITY, limit: MIN_RUN + 1, rng });
        if (!white) continue;
        const board = newBoard(white, n);
        if (!reduce(board) || !chooseClues(board, rng)) continue;
        const printed = printDigits(board);
        if (printed) return printed;
    }

    throw new Error(`kakuro: no puzzle built for ${n}×${n}`);
}
