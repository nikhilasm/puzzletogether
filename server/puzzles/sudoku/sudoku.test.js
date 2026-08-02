import { describe, expect, it } from 'vitest';

import { emptyBoard } from '../../../shared/board-reducer.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { createRng } from '../rng.js';

import { rate } from './rate.js';
import { countSolutions, createDims } from './solver.js';

import sudoku from './index.js';

/**
 * How many puzzles the invariant checks generate. Phase 5 raises this to the 200 per type the spec
 * calls for; it stays low here so the suite runs in a second.
 */
const SAMPLE_SIZE = 20;

/** Generates a puzzle from an explicit seed. */
function generate(difficulty, seed) {
    return sudoku.create({
        difficulty,
        size: { rows: 9, cols: 9 },
        rng: createRng(seed),
    });
}

/** The numeric grid a doc's givens describe, with 0 for the cells players must fill. */
function toGrid(doc) {
    return Uint8Array.from(doc.cells, (cell) => (cell.given == null ? 0 : Number(cell.given)));
}

/** A board with every non-given cell filled in from the solution. */
function solvedBoard(doc, solution) {
    const board = emptyBoard();
    doc.cells.forEach((cell, idx) => {
        if (cell.given != null) return;
        board.cells[idx] = { value: solution[idx], marks: [], by: 'p1', seq: idx + 1 };
    });
    board.seq = doc.cells.length;
    return board;
}

describe('sudoku generation', () => {
    const dims = createDims(9);

    it.each(['easy', 'medium', 'hard'])(
        'produces %s puzzles with exactly one solution',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc, solution } = generate(difficulty, 1000 + i);

                expect(countSolutions(toGrid(doc), dims, 2)).toBe(1);
                expect(solution).toHaveLength(81);
            }
        },
    );

    /**
     * The label always tells the truth about the puzzle. Difficulty targeting is a search that can
     * miss; mislabelling would be a bug, so `doc.difficulty` is the measured rating and never the
     * requested one.
     */
    it.each(['easy', 'medium', 'hard'])(
        'labels %s puzzles with their measured rating',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc } = generate(difficulty, 2000 + i);
                expect(doc.difficulty).toBe(rate(toGrid(doc), 9));
            }
        },
    );

    it.each(['easy', 'medium', 'hard'])(
        'hits the requested %s difficulty almost always',
        (difficulty) => {
            let hits = 0;
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                if (generate(difficulty, 3000 + i).doc.difficulty === difficulty) hits += 1;
            }
            expect(hits / SAMPLE_SIZE).toBeGreaterThanOrEqual(0.9);
        },
    );

    it('rates a puzzle the same way every time it is asked', () => {
        const { doc } = generate('medium', 4242);
        const grid = toGrid(doc);
        expect(rate(grid, 9)).toBe(rate(grid, 9));
    });

    it('reproduces the same puzzle from the same seed', () => {
        const first = generate('medium', 777);
        const second = generate('medium', 777);

        expect(second.doc.cells).toEqual(first.doc.cells);
        expect(second.solution).toEqual(first.solution);
    });

    it('never puts a solution value in the document it sends clients', () => {
        const { doc, solution } = generate('hard', 31337);
        const blanks = doc.cells.filter((cell) => cell.given == null);

        expect(blanks.length).toBeGreaterThan(0);
        expect(doc.cells.map((cell) => cell.given)).not.toEqual(solution);
    });

    it('rejects a grid size it has no region shape for', () => {
        expect(() =>
            sudoku.create({ difficulty: 'easy', size: { rows: 7, cols: 7 }, rng: createRng(1) }),
        ).toThrow(RangeError);
    });
});

describe('sudoku module interface', () => {
    it('rejects an op targeting a given', () => {
        const { doc } = generate('easy', 55);
        const givenIdx = doc.cells.findIndex((cell) => cell.given != null);

        expect(
            sudoku.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: givenIdx, value: '5' }),
        ).toBe(false);
    });

    it('rejects a value outside the puzzle alphabet', () => {
        const { doc } = generate('easy', 56);
        const blankIdx = doc.cells.findIndex((cell) => cell.given == null);

        expect(
            sudoku.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: blankIdx, value: 'z' }),
        ).toBe(false);
    });

    it('accepts a legal value in an empty cell', () => {
        const { doc } = generate('easy', 57);
        const blankIdx = doc.cells.findIndex((cell) => cell.given == null);

        expect(
            sudoku.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: blankIdx, value: '1' }),
        ).toBe(true);
    });

    it('reports completion only when every cell matches the solution', () => {
        const { doc, solution } = generate('easy', 58);
        const board = solvedBoard(doc, solution);

        expect(sudoku.isComplete(doc, board, solution)).toBe(true);

        const blankIdx = doc.cells.findIndex((cell) => cell.given == null);
        board.cells[blankIdx] = { value: null, marks: [], by: 'p1', seq: 99 };
        expect(sudoku.isComplete(doc, board, solution)).toBe(false);
    });

    it('classifies checked cells as correct, wrong, or empty', () => {
        const { doc, solution } = generate('easy', 59);
        const blanks = doc.cells
            .map((cell, idx) => (cell.given == null ? idx : -1))
            .filter((idx) => idx >= 0);
        const [correctIdx, wrongIdx, emptyIdx] = blanks;

        const board = emptyBoard();
        board.cells[correctIdx] = { value: solution[correctIdx], marks: [], by: 'p1', seq: 1 };
        const wrongValue = solution[wrongIdx] === '1' ? '2' : '1';
        board.cells[wrongIdx] = { value: wrongValue, marks: [], by: 'p1', seq: 2 };

        const result = sudoku.checkCells(doc, board, solution, [correctIdx, wrongIdx, emptyIdx]);
        expect(result[correctIdx]).toBe('correct');
        expect(result[wrongIdx]).toBe('wrong');
        expect(result[emptyIdx]).toBe('empty');
    });
});
