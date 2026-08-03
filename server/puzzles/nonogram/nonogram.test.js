import { describe, expect, it } from 'vitest';

import { emptyBoard } from '../../../shared/board-reducer.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { createRng } from '../rng.js';

import { CROSS, FILL, UNKNOWN, cluesFor, lineSolve, solveLine } from './line-solver.js';

import nonogram from './index.js';

/**
 * How many puzzles the invariant checks generate. Phase 5 raises this to the 200 per type the spec
 * calls for; it stays low here so the suite runs in a second.
 */
const SAMPLE_SIZE = 10;

/** Generates a puzzle from an explicit seed. */
function generate(difficulty, seed, n = 10) {
    return nonogram.create({
        difficulty,
        size: { rows: n, cols: n },
        rng: createRng(seed),
    });
}

/** A board holding exactly the filled cells of the solution. */
function solvedBoard(solution) {
    const board = emptyBoard();
    solution.forEach((value, idx) => {
        if (value == null) return;
        board.cells[idx] = { value, marks: [], by: 'p1', seq: idx + 1 };
    });
    board.seq = solution.length;
    return board;
}

describe('the nonogram line-solver', () => {
    it('reads a run of filled cells as a clue, and an empty line as [0]', () => {
        expect(cluesFor([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3]);
        expect(cluesFor([0, 0, 0])).toEqual([0]);
        expect(cluesFor([1, 1, 1])).toEqual([3]);
    });

    /** The classic overlap deduction: a block longer than half the line has a forced middle. */
    it('finds the overlap a block longer than half its line forces', () => {
        const line = solveLine([4], new Uint8Array(5).fill(UNKNOWN));

        expect(Array.from(line)).toEqual([UNKNOWN, FILL, FILL, FILL, UNKNOWN]);
    });

    it('crosses out a line its clues cannot reach', () => {
        const line = solveLine([2], Uint8Array.from([UNKNOWN, UNKNOWN, FILL, UNKNOWN, CROSS]));

        // The only 2-block containing cell 2 and avoiding cell 4 is cells 1-2 or 2-3; cell 4 is out.
        expect(line[4]).toBe(CROSS);
        expect(line[2]).toBe(FILL);
    });

    it('reports a contradiction rather than guessing', () => {
        expect(solveLine([3], Uint8Array.from([CROSS, CROSS, CROSS, UNKNOWN, UNKNOWN]))).toBe(null);
    });

    /**
     * A 2×2 with every line clued `[1]` has two answers — the two diagonals — and is exactly the
     * ambiguity generation exists to reject. The solver has to fail to finish it rather than pick one.
     */
    it('stops short of a puzzle that has more than one answer', () => {
        const result = lineSolve([[1], [1]], [[1], [1]], 2, 2);

        expect(result.solved).toBe(false);
        expect(Array.from(result.grid)).toEqual([UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN]);
    });

    /** The last sweep proves there is nothing left to find, so it is not work the puzzle demanded. */
    it('does not count the sweep that deduces nothing', () => {
        // Every cell filled: one sweep of the rows settles it outright.
        expect(lineSolve([[2], [2]], [[2], [2]], 2, 2).sweeps).toBe(1);
    });
});

describe('nonogram generation', () => {
    it.each(['easy', 'medium', 'hard'])(
        'produces %s puzzles a line-solver can finish',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc } = generate(difficulty, 1000 + i);
                const solved = lineSolve(doc.meta.rowClues, doc.meta.colClues, 10, 10);

                expect(solved.solved, 'ambiguous puzzle escaped the rejection').toBe(true);
            }
        },
    );

    /**
     * The label always tells the truth about the puzzle. Density steers the search, but what comes
     * back is the rating the puzzle earned from the solver — the same rule sudoku follows, and the
     * reason nonogram measures its difficulty where kenken parameterises it.
     */
    it.each(['easy', 'medium', 'hard'])(
        'labels %s puzzles with their measured rating',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc } = generate(difficulty, 2000 + i, 15);
                const sweeps = lineSolve(doc.meta.rowClues, doc.meta.colClues, 15, 15).sweeps;

                const expected =
                    sweeps >= 15 * 0.45 ? 'hard' : sweeps >= 15 * 0.3 ? 'medium' : 'easy';
                expect(doc.difficulty).toBe(expected);
            }
        },
    );

    it.each([5, 10, 15, 20])('hits the requested difficulty at %ix%i', (side) => {
        for (const difficulty of ['easy', 'medium', 'hard']) {
            const { doc } = generate(difficulty, 3000 + side, side);
            expect(doc.difficulty, `${side}x${side} ${difficulty}`).toBe(difficulty);
        }
    });

    it('clues the grid it actually drew', () => {
        const { doc, solution } = generate('medium', 4242);

        for (let row = 0; row < 10; row += 1) {
            const cells = Array.from({ length: 10 }, (_u, col) =>
                solution[row * 10 + col] ? 1 : 0,
            );
            expect(doc.meta.rowClues[row]).toEqual(cluesFor(cells));
        }
        for (let col = 0; col < 10; col += 1) {
            const cells = Array.from({ length: 10 }, (_u, row) =>
                solution[row * 10 + col] ? 1 : 0,
            );
            expect(doc.meta.colClues[col]).toEqual(cluesFor(cells));
        }
    });

    it('reproduces the same puzzle from the same seed', () => {
        const first = generate('medium', 777);
        const second = generate('medium', 777);

        expect(second.doc.meta).toEqual(first.doc.meta);
        expect(second.solution).toEqual(first.solution);
    });

    /**
     * The clues *are* the puzzle, so they necessarily describe the picture — but the cell list the
     * client renders must give nothing away beyond them.
     */
    it('sends a document with every cell blank and editable', () => {
        const { doc } = generate('hard', 31337);

        expect(
            doc.cells.every((cell) => cell.given == null && !cell.block && cell.label == null),
        ).toBe(true);
    });

    it('generates its largest size within a worker-thread budget', () => {
        const started = Date.now();
        const { doc } = generate('hard', 909, 20);

        expect(lineSolve(doc.meta.rowClues, doc.meta.colClues, 20, 20).solved).toBe(true);
        expect(Date.now() - started).toBeLessThan(10_000);
    });

    it('rejects a grid size it does not offer', () => {
        expect(() =>
            nonogram.create({ difficulty: 'easy', size: { rows: 4, cols: 4 }, rng: createRng(1) }),
        ).toThrow(RangeError);
    });
});

describe('nonogram module interface', () => {
    it('accepts the batched fill op that a drag becomes', () => {
        const { doc } = generate('easy', 55);

        expect(
            nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.FILL, cells: [0, 1, 2], value: '#' }),
        ).toBe(true);
        expect(
            nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.FILL, cells: [0, 1], value: null }),
        ).toBe(true);
        expect(
            nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.FILL, cells: [], value: '#' }),
        ).toBe(false);
        expect(
            nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.FILL, cells: [0, 999], value: '#' }),
        ).toBe(false);
    });

    it('accepts only the fill and cross characters', () => {
        const { doc } = generate('easy', 56);

        expect(nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: 0, value: '#' })).toBe(
            true,
        );
        expect(nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: 0, value: 'x' })).toBe(
            true,
        );
        expect(nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: 0, value: '5' })).toBe(
            false,
        );
    });

    /** A cross is the note, so there are no pencil marks to make. */
    it('rejects pencil marks', () => {
        const { doc } = generate('easy', 57);

        expect(nonogram.validateOp(doc, { opId: 'a', t: OP_TYPE.MARKS, cell: 0, marks: [1] })).toBe(
            false,
        );
    });

    /**
     * The rule that makes nonogram unlike every other type: crosses are the player's notes about
     * where the picture is not, so the grid solves with them, without them, and with them wrong.
     */
    it('completes on the filled cells alone, whatever the player marked the blanks', () => {
        const { doc, solution } = generate('easy', 58);
        const board = solvedBoard(solution);

        expect(nonogram.isComplete(doc, board, solution)).toBe(true);

        const blank = solution.findIndex((value) => value == null);
        board.cells[blank] = { value: 'x', marks: [], by: 'p1', seq: 500 };
        expect(nonogram.isComplete(doc, board, solution)).toBe(true);

        const filled = solution.findIndex((value) => value != null);
        board.cells[filled] = { value: 'x', marks: [], by: 'p1', seq: 501 };
        expect(nonogram.isComplete(doc, board, solution)).toBe(false);
    });

    it('grades a cross on whether the cell is genuinely blank', () => {
        const { doc, solution } = generate('easy', 59);
        const filled = solution.findIndex((value) => value != null);
        const blank = solution.findIndex((value) => value == null);
        const untouched = solution.findIndex((value, idx) => value == null && idx !== blank);

        const board = emptyBoard();
        board.cells[filled] = { value: '#', marks: [], by: 'p1', seq: 1 };
        board.cells[blank] = { value: 'x', marks: [], by: 'p1', seq: 2 };

        const result = nonogram.checkCells(doc, board, solution, [filled, blank, untouched]);
        expect(result[filled]).toBe('correct');
        expect(result[blank]).toBe('correct');
        expect(result[untouched]).toBe('empty');
    });

    it('marks a fill where nothing goes as wrong', () => {
        const { doc, solution } = generate('easy', 60);
        const blank = solution.findIndex((value) => value == null);

        const board = emptyBoard();
        board.cells[blank] = { value: '#', marks: [], by: 'p1', seq: 1 };

        expect(nonogram.checkCells(doc, board, solution, [blank])[blank]).toBe('wrong');
    });
});
