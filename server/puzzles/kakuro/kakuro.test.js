import { describe, expect, it } from 'vitest';

import { emptyBoard } from '../../../shared/board-reducer.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { createRng } from '../rng.js';

import { isConnected, partnerOf } from './layout.js';
import { clueSquare, deriveRuns, MAX_RUN, MIN_RUN } from './runs.js';
import { solveKakuro } from './solver.js';

import kakuro from './index.js';

/** How many puzzles the invariant checks generate. Kept low so the suite stays quick. */
const SAMPLE_SIZE = 6;

/** Generates a puzzle from an explicit seed. */
function generate(difficulty, seed, n = 9) {
    return kakuro.create({ difficulty, size: { rows: n, cols: n }, rng: createRng(seed) });
}

/** The layout and printed digits a document implies, which is what the solver takes. */
function toPuzzle(doc) {
    const white = Uint8Array.from(doc.cells, (cell) => (cell.block ? 0 : 1));
    const pinned = new Uint8Array(white.length);
    doc.cells.forEach((cell, idx) => {
        if (cell.given != null) pinned[idx] = Number(cell.given);
    });
    return { runs: doc.meta.runs, white, pinned };
}

/** A board holding a value in one cell, for the op and completion checks. */
function boardWith(values) {
    const board = emptyBoard();
    for (const [cell, value] of Object.entries(values)) {
        board.cells[cell] = { value, marks: [], by: null, seq: 1 };
    }
    return board;
}

describe('kakuro generation', () => {
    /**
     * The load-bearing property, and the one that took the most work to get: a kakuro drawn at
     * random is almost never uniquely solvable, so generation repairs it by blocking squares and,
     * where it cannot, by printing a digit. Whatever route it took, what comes out has one answer.
     */
    it.each(['easy', 'medium', 'hard'])('produces %s puzzles with exactly one answer', (level) => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { doc, solution } = generate(level, 4000 + i);
            const { answers, complete } = solveKakuro(toPuzzle(doc), 2);

            expect(complete, `seed ${4000 + i} was verified`).toBe(true);
            expect(answers, `seed ${4000 + i} has one answer`).toHaveLength(1);
            expect(solution).toHaveLength(81);
        }
    });

    /** The answer the room is checked against has to be the answer the puzzle actually has. */
    it('ships the solution its own clues imply', () => {
        const { doc, solution } = generate('medium', 4100);
        const [answer] = solveKakuro(toPuzzle(doc), 2).answers;

        const found = Array.from(answer, (digit, idx) =>
            doc.cells[idx].block ? null : String(digit),
        );
        expect(found).toEqual(solution);
    });

    /**
     * A clue that does not describe its own run is a puzzle nobody can solve, however unique the
     * solver says it is. Both halves are checked: the sum, and the distinctness a kakuro run has.
     */
    it('gives every run a sum its own answer adds up to, with no digit twice', () => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { doc, solution } = generate('medium', 4200 + i);

            for (const run of doc.meta.runs) {
                const digits = run.cells.map((cell) => Number(solution[cell]));
                expect(digits.reduce((total, digit) => total + digit, 0)).toBe(run.sum);
                expect(new Set(digits).size).toBe(digits.length);
            }
        }
    });

    /**
     * The property the fill-first generator could not hold, and the reason this one exists
     * (ADR-0015). Deriving sums from a random filling forced runs down to an average of two and a
     * half squares to reach a single answer, which is not what a kakuro looks like: a run of two is
     * a pair of digits, and a puzzle made of them has nothing to reason about.
     *
     * **The floor is well under what is measured, and was lowered once.** It was 3.4 against a
     * measured 4.0 to 4.2, before ADR-0016 gave the layout a block density and the two aesthetics
     * turned out to be one dial: every block shortens two runs, so a grid patterned enough to look
     * like a kakuro has runs of about 3.5 rather than 4.1. Pooled over thirty seeds a medium 13×13
     * now averages 3.4 with individual grids from 2.6 to 3.9, so a floor at 3.4 would have been
     * measuring which seeds the test happened to name. This one has room for that spread and still
     * fails loudly at the 2.5 the fill-first generator produced, which is what it is for.
     */
    it('gives its runs a real length rather than filling the grid with pairs', () => {
        for (const side of [11, 13]) {
            const lengths = [];
            for (let i = 0; i < 3; i += 1) {
                const { doc } = generate('medium', 4250 + i, side);
                for (const run of doc.meta.runs) lengths.push(run.cells.length);
            }

            const mean = lengths.reduce((total, length) => total + length, 0) / lengths.length;
            expect(mean, `${side}×${side} mean run length`).toBeGreaterThan(3.1);
            expect(Math.max(...lengths), `${side}×${side} longest run`).toBeGreaterThan(4);
        }
    });

    /**
     * The pattern, which is what ADR-0016 exists for. The complaint it answers was never density:
     * the layouts before it blocked 17 to 30 per cent of the interior, which is what a printed
     * kakuro carries. It was that the blocks were placed at random, so an interior square agreed
     * with its 180° partner 71 per cent of the time against the 69 per cent two coin flips agree by
     * chance, and the grid read as noise rather than as design.
     *
     * **Symmetry is of the interior, not of the grid.** A kakuro's clue border is the top row and
     * left column only, so turning the whole grid would map that border onto squares a player fills.
     *
     * Not exact, because repair may block one square without its partner when nothing else settles
     * the grid, and a lone odd block is a better puzzle than an unfair one. Across 240 puzzles at
     * every size and difficulty, 203 came out exactly symmetric and the worst carried six unmirrored
     * squares, so a rule that stopped working would pass this by nothing like the margin it has.
     */
    it('draws the interior as a rotationally symmetric pattern', () => {
        for (const side of [7, 9, 13]) {
            for (const level of ['easy', 'hard']) {
                const { doc } = generate(level, 5100 + side, side);
                let unmirrored = 0;

                for (let row = 1; row < side; row += 1) {
                    for (let col = 1; col < side; col += 1) {
                        const idx = row * side + col;
                        const partner = partnerOf(idx, side);
                        if (doc.cells[idx].block !== doc.cells[partner].block) unmirrored += 1;
                    }
                }

                expect(unmirrored, `${side}×${side} ${level}`).toBeLessThanOrEqual(8);
            }
        }
    });

    /**
     * A walled-off region is a second puzzle sharing the page: separately clued, separately
     * ambiguous, and visibly wrong. Nothing else catches it, since two disconnected halves are
     * perfectly consistent with each other, so the solver calls such a grid settled and fair.
     *
     * New with symmetric placement and needed because of it: a single block rarely walls a grid off,
     * while a mirrored pair at a quarter density does it readily.
     */
    it('leaves every open square reachable from every other', () => {
        for (const side of [9, 13]) {
            for (let i = 0; i < 3; i += 1) {
                const { doc } = generate('medium', 5200 + i, side);
                const white = Uint8Array.from(doc.cells, (cell) => (cell.block ? 0 : 1));
                expect(isConnected(white, side), `${side}×${side} seed ${5200 + i}`).toBe(true);
            }
        }
    });

    /**
     * The invariant clueSquare rests on: it subtracts 1 or n with no bounds check, on the promise
     * that no run can start against the grid's edge. Layout keeps that promise by construction,
     * since it only ever considers interior squares, and this is the assertion of it.
     */
    it('blocks the whole clue border', () => {
        for (const side of [7, 11]) {
            const { doc } = generate('medium', 5300, side);
            for (let at = 0; at < side; at += 1) {
                expect(doc.cells[at].block, `${side}×${side} row 0 column ${at}`).toBe(true);
                expect(doc.cells[at * side].block, `${side}×${side} row ${at} column 0`).toBe(true);
            }
        }
    });

    /** Runs of one square are a given wearing a clue, and runs of ten cannot be filled at all. */
    it('keeps every run between two and nine squares', () => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { doc } = generate('hard', 4300 + i, 11);
            const white = Uint8Array.from(doc.cells, (cell) => (cell.block ? 0 : 1));

            for (const run of deriveRuns(white, 11)) {
                expect(run.cells.length).toBeGreaterThanOrEqual(MIN_RUN);
                expect(run.cells.length).toBeLessThanOrEqual(MAX_RUN);
            }
        }
    });

    /**
     * Every sum is printed on the blocked square the run starts against, and every blocked square
     * that starts no run carries no clue at all. That second half is what stops a plain block being
     * drawn with a diagonal through it.
     */
    it('prints each sum on the square its run starts against, and nowhere else', () => {
        const { doc } = generate('medium', 4400);
        const clued = new Map();

        for (const run of doc.meta.runs) {
            const square = clueSquare(run, 9);
            expect(doc.cells[square].block).toBe(true);
            const clue = doc.cells[square].clue;
            expect(run.dir === 'A' ? clue.across : clue.down).toBe(run.sum);
            clued.set(square, true);
        }

        doc.cells.forEach((cell, idx) => {
            if (cell.block && !clued.has(idx)) expect(cell.clue).toBeNull();
            if (!cell.block) expect(cell.clue).toBeNull();
        });
    });

    /** A printed digit is part of the answer, not a contradiction of it. */
    it('prints only digits the answer agrees with', () => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { doc, solution } = generate('hard', 4500 + i);
            for (const [idx, cell] of doc.cells.entries()) {
                if (cell.given != null) expect(cell.given).toBe(solution[idx]);
            }
        }
    });

    it('measures the difficulty it reports rather than repeating the request', () => {
        const { doc } = generate('easy', 4600);
        expect(['easy', 'medium', 'hard']).toContain(doc.difficulty);
    });

    it('refuses a size it does not offer', () => {
        expect(() => generate('easy', 4700, 6)).toThrow(RangeError);
        expect(() => generate('easy', 4700, 15)).toThrow(RangeError);
        expect(() =>
            kakuro.create({
                difficulty: 'easy',
                size: { rows: 9, cols: 11 },
                rng: createRng(4701),
            }),
        ).toThrow(RangeError);
    });
});

describe('kakuro validateOp', () => {
    const { doc } = generate('medium', 4800);
    const open = doc.cells.findIndex((cell) => !cell.block && cell.given == null);
    const clue = doc.cells.findIndex((cell) => cell.block);

    it('accepts a digit of its alphabet in an open square', () => {
        const op = { opId: 'a', t: OP_TYPE.SET, cell: open, value: '7' };
        expect(kakuro.validateOp(doc, op)).toBe(true);
    });

    it('refuses a clue square', () => {
        const op = { opId: 'a', t: OP_TYPE.SET, cell: clue, value: '7' };
        expect(kakuro.validateOp(doc, op)).toBe(false);
    });

    /**
     * The schema admits eight characters so crossword rebus squares can exist (ADR-0007), so this
     * module is the only thing holding a kakuro square to one digit. Written as a length test as
     * well as a membership test, since includes on a string matches substrings.
     */
    it('refuses a value of more than one digit, and one outside the alphabet', () => {
        for (const value of ['12', '0', 'A', '123456']) {
            const op = { opId: 'a', t: OP_TYPE.SET, cell: open, value };
            expect(kakuro.validateOp(doc, op), value).toBe(false);
        }
    });

    it('refuses the batched fill op, which only a nonogram drag produces', () => {
        const op = { opId: 'a', t: OP_TYPE.FILL, cells: [open], value: '7' };
        expect(kakuro.validateOp(doc, op)).toBe(false);
    });

    it('takes pencil marks of 1 to 9 and refuses a mark outside them', () => {
        const marks = { opId: 'a', t: OP_TYPE.MARKS, cell: open, marks: [1, 5, 9] };
        expect(kakuro.validateOp(doc, marks)).toBe(true);
        expect(kakuro.validateOp(doc, { ...marks, marks: [10] })).toBe(false);
    });
});

describe('kakuro completion', () => {
    const { doc, solution } = generate('medium', 4900);

    /** A clue square is already correct: it holds nothing, and the solution says nothing about it. */
    it('is complete when every open square matches, blocks and all', () => {
        const filled = {};
        doc.cells.forEach((cell, idx) => {
            if (!cell.block && cell.given == null) filled[idx] = solution[idx];
        });

        expect(kakuro.isComplete(doc, boardWith(filled), solution)).toBe(true);
    });

    it('is not complete while a square is wrong or empty', () => {
        const filled = {};
        doc.cells.forEach((cell, idx) => {
            if (!cell.block && cell.given == null) filled[idx] = solution[idx];
        });
        const open = Number(Object.keys(filled)[0]);

        expect(kakuro.isComplete(doc, boardWith({ ...filled, [open]: '0' }), solution)).toBe(false);
        const { [open]: _dropped, ...missing } = filled;
        expect(kakuro.isComplete(doc, boardWith(missing), solution)).toBe(false);
    });

    it('grades a check as correct, wrong, or empty', () => {
        const open = doc.cells.findIndex((cell) => !cell.block && cell.given == null);
        const wrong = String((Number(solution[open]) % 9) + 1);
        const board = boardWith({ [open]: solution[open] });

        expect(kakuro.checkCells(doc, board, solution, [open])[open]).toBe('correct');
        expect(kakuro.checkCells(doc, boardWith({ [open]: wrong }), solution, [open])[open]).toBe(
            'wrong',
        );
        expect(kakuro.checkCells(doc, emptyBoard(), solution, [open])[open]).toBe('empty');
    });
});
