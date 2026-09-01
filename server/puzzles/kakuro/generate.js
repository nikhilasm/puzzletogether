/**
 * Kakuro generation: draw a layout, then *choose* its clues, each one for how much it settles the
 * grid (design-spec.md §8).
 *
 * **The clues are the puzzle, so the clues are what gets chosen.** The first version of this file
 * filled the grid with digits and read the sums off the filling. That produces middling sums, and a
 * middling sum says almost nothing: 20 across four squares is fourteen different sets. The grids
 * came out ambiguous, and the only way to rescue them was to keep cutting runs shorter until the
 * clues had nothing left to be vague about, which is why runs averaged two and a half squares
 * against the four or more a real kakuro has (ADR-0015).
 *
 * Choosing clue values instead inverts it. Nothing is filled in; a solver narrows what each square
 * could hold, and each clue is picked for how much it narrows the whole board:
 *
 * 1. **Lay out the blocks** as a symmetric clustered pattern at the difficulty's density, which is
 *    layout.js and is where run length is asked for rather than left over (ADR-0016).
 * 2. **Seed the crossings.** For a square whose two clues are both unchosen, pick the pair that
 *    pins it hardest: 26 in three squares is {6,8,9}, 21 in six is {1..6}, and a square in both is a
 *    6 before anything else is known.
 * 3. **Choose the rest, loosest clue first.** The clue with the most values still open carries the
 *    most uncertainty, so it is the one worth deciding. Which of its values to take is the
 *    difficulty knob: the most constraining one makes an easy puzzle, a looser one leaves more of
 *    the work for the solver.
 * 4. **Repair what is left ambiguous**, by re-choosing the pair of clues crossing an unsettled
 *    square, and failing that by blocking the square out of the grid.
 *
 * Two global facts keep the search honest. The across clues and the down clues both add up to the
 * same total, so a value that makes those two totals unreachable is refused before it is tried. And
 * a settled board is a unique board: narrowing is sound, so two answers would leave a square holding
 * two digits.
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
 * How many boards to build before settling for the nearest one to the difficulty asked for.
 *
 * Generous for sudoku's reason: every attempt produces a fair puzzle, so this is a budget for
 * hitting the *rating*, and one board lands on the exact band asked for well under half the time.
 * The wall clock below is what actually stops it at the larger sizes.
 */
const MAX_RESTARTS = 40;

/**
 * Wall-clock ceiling on the search for a puzzle at the difficulty asked for.
 *
 * Generation runs in a worker thread against a pre-warmed pool, so this is not a latency a player
 * waits on; it bounds how much CPU one puzzle may cost while a 13×13 is being looked for.
 */
const TIME_BUDGET_MS = 4000;

/**
 * Longest run any layout may contain.
 *
 * One number for every difficulty, where this was `{ easy: 7, medium: 8, hard: 8 }`. That was very
 * nearly a dead knob: the grid's own width caps it, so after `limitFor` clamped it the three levels
 * evaluated to the same run length at every offered size except 13×13. Density carries the layout
 * half of difficulty instead, and separates at all four.
 *
 * Not raised past 8. At 9 the repair has to block so many squares to settle the grid that a 13×13
 * came back with 20 open squares out of 144, which is a smaller puzzle drawn on a larger board.
 */
const RUN_LIMIT = 8;

/**
 * Share of the interior each difficulty blocks out.
 *
 * The layout knob, in the units the eye reads. Every block shortens two runs, so this and run length
 * are one dial seen from two sides, and stating it as density is what lets it separate the levels at
 * a size whose width has already capped run length.
 *
 * Calibrated by measurement against the bands in rate.js, within the 20 to 30 per cent a printed
 * kakuro carries. The cost is stated rather than hidden: an easy grid at 30 per cent has runs of
 * about three squares, which is what an easy kakuro looks like, and hard stays near four.
 */
const BLOCK_DENSITY = { easy: 0.3, medium: 0.24, hard: 0.2 };

/**
 * How much denser each rung of the fallback ladder draws, and where the ladder stops.
 *
 * The ceiling is not a legality: layout.js will keep placing pairs as long as they leave legal runs.
 * It is the point past which the grid stops being a puzzle and starts being a frame, so a request
 * that cannot be met inside it is better met by printing a digit.
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
 * constraining to 1 for the least.
 *
 * The second difficulty knob, and the one that works where run length cannot: a 9×9's interior is
 * eight squares wide, so every difficulty ends up with the same run ceiling there, and without this
 * the three levels were the same puzzle drawn three times.
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
 *
 * Grouped rather than reduced to the single best, because seeding is a *preference*, not a
 * requirement. A board where every crossing takes the hardest possible pair usually contradicts
 * itself within a few squares, and the first version of this step failed outright at every size
 * above 7×7 for exactly that reason. Falling back a group at a time keeps the pressure while letting
 * the board stay consistent.
 *
 * Capped at three digits of overlap and at PAIRS_PER_GROUP options, since a looser pair than that is
 * not seeding anything and step 3 chooses better than a table can.
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
 * The longest run this grid may hold, which is the smaller of the limit and what the grid can cut.
 *
 * A run of nine on a 9×9 spans the whole interior, so nothing is ever split and the layout comes out
 * as one open block that no amount of clue-choosing can settle: every draw at that size failed until
 * the limit was held below the interior's width.
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
 * Whether the across clues and the down clues can still add up to the same total.
 *
 * Both totals count every digit in the grid once, so they are equal in any finished puzzle. Holding
 * a clue to that as it is chosen is the cheapest global constraint there is: it is one interval
 * against another, and it refuses values that would otherwise be found out only at the very end.
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

    // Seeded from the one clue that changed: choosing a value only ever narrows, and the rest of
    // the board is already consistent with itself, so there is nothing for a full pass to find.
    const domains = Int32Array.from(board.domains);
    const ok = narrow(domains, board.runs, board.index, [run]);
    run.sum = previous;

    return ok ? { domains, score: ambiguity(domains) } : null;
}

/**
 * Seeds the crossings: where neither clue through a square is chosen, take a pair that pins that
 * square hard.
 *
 * This is the one step that does not measure the whole board, and it does not have to. A crossing
 * with both clues open is unconstrained by construction, so the local question and the global one
 * have the same answer, and answering it locally is far cheaper than weighing the grid.
 *
 * **A crossing that will not take any pair is left alone rather than failing the board.** Step 3
 * chooses for it, more slowly and with the whole grid in view. Seeding is an optimisation, so it is
 * allowed to decline.
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
 * Chooses every remaining clue, loosest first, each for how much it settles the board.
 *
 * The clue with the most values still open is the one carrying the most uncertainty, so deciding it
 * is worth more than deciding a clue that was nearly pinned already. Values are weighed by what the
 * board looks like afterwards, which is the whole point: a clue is good when the squares far away
 * from it have fewer digits left.
 */
function chooseClues(board, rng, reach = 0) {
    for (;;) {
        const open = openValues(board);
        if (!open) return false;
        if (open.size === 0) return true;
        if (!totalsCanMeet(board.runs, open)) return false;

        // Loosest first, but a clue that cannot be decided is not a dead end for the board: another
        // clue may still be decidable, and deciding it narrows the one that was stuck. Failing on the
        // first refusal threw away half of all attempts at the larger sizes.
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
 * The value to give one clue, chosen for how much of the board it settles.
 *
 * **Which end of that ranking to take is the difficulty knob.** Taking the most constraining value
 * every time makes the tightest puzzle the layout can carry, which is an easy one: everything falls
 * out in a few sweeps. Taking a looser value leaves more for the solver to do later, and leaves it
 * spread further across the grid. Run length alone could not separate the three levels, because the
 * grid's own width caps it and medium and hard end up sharing a ceiling at every size offered.
 *
 * Loose is not the same as unsettled. Every value here has been weighed and kept only if the board
 * still holds together; the repair afterwards is what guarantees one answer.
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
 * most.
 *
 * Preferred over blocking the square, because it costs the puzzle nothing: the grid keeps its shape
 * and its runs keep their length. Only when no pair of values helps is a square taken out.
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
 * Blocks an unsettled square out of the grid, and re-chooses the clues that lost their runs.
 *
 * The move of last resort, and the one that costs the puzzle something: two runs get shorter, and
 * the grid gains a clue square where a player had a square to fill. It is still better than printing
 * a digit, which is what the previous generator did here.
 *
 * **The symmetric pair is offered first**, so the pattern layout.js drew survives the repair
 * (ADR-0016). A pair costs four runs rather than two, which is the cheaper of the two prices: a
 * single block leaves one square unmirrored in an otherwise deliberate grid, and that is the thing
 * the eye finds.
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
 * board came out less ambiguous than it went in.
 *
 * The clues on runs the blocking left untouched are carried over by their square list, so the work
 * already done is not thrown away. Everything else is chosen again from what the new shape implies.
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
 * Prints digits into a board that would not settle, which is what keeps generation total.
 *
 * Never reached in measurement, and kept because "usually" is not a guarantee: a run of unlucky
 * layouts must still end in a puzzle rather than an exception. The digits printed are an answer's
 * own, so the board stays consistent.
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
    // are a smaller thing to reason about and a far easier thing to settle, which is the trade
    // generation makes rather than failing: at worst an easier puzzle than was ordered.
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
