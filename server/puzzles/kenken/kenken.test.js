import { describe, expect, it } from 'vitest';

import { emptyBoard } from '../../../shared/board-reducer.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { createRng } from '../rng.js';

import { countSolutions, randomLatinSquare } from './solver.js';

import kenken from './index.js';

/**
 * How many puzzles the invariant checks generate. Phase 5 raises this to the 200 per type the spec
 * calls for; it stays low here so the suite runs in a second.
 */
const SAMPLE_SIZE = 12;

/** Generates a puzzle from an explicit seed. */
function generate(difficulty, seed, n = 4) {
    return kenken.create({
        difficulty,
        size: { rows: n, cols: n },
        rng: createRng(seed),
    });
}

/** Applies a cage's operation to its solution values, to confirm the clue tells the truth. */
function evaluate(op, values) {
    const [high, low] = [Math.max(...values), Math.min(...values)];
    switch (op) {
        case '=':
            return values[0];
        case '+':
            return values.reduce((sum, value) => sum + value, 0);
        case '*':
            return values.reduce((product, value) => product * value, 1);
        case '-':
            return high - low;
        default:
            return high / low;
    }
}

describe('kenken generation', () => {
    it.each(['easy', 'medium', 'hard'])(
        'produces %s puzzles with exactly one solution',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc, solution } = generate(difficulty, 1000 + i);

                expect(countSolutions(doc.meta.cages, 4, 2)).toBe(1);
                expect(solution).toHaveLength(16);
            }
        },
    );

    /**
     * The clue has to be true of the answer, or the puzzle is unsolvable however unique the solver
     * says it is. This is the check that the cage partition and the clue assignment agree.
     */
    it('gives every cage a clue its own solution values satisfy', () => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { doc, solution } = generate('medium', 2000 + i, 5);

            for (const cage of doc.meta.cages) {
                const values = cage.cells.map((idx) => Number(solution[idx]));
                expect(evaluate(cage.op, values), `cage ${cage.id} ${cage.target}${cage.op}`).toBe(
                    cage.target,
                );
            }
        }
    });

    it('covers every cell exactly once, in connected cages', () => {
        const { doc } = generate('hard', 3131, 6);
        const seen = new Set();

        for (const cage of doc.meta.cages) {
            for (const cell of cage.cells) {
                expect(seen.has(cell), `cell ${cell} is in two cages`).toBe(false);
                seen.add(cell);
            }
            // Connected: every cell after the first touches one already in the cage.
            const reached = new Set([cage.cells[0]]);
            for (let pass = 0; pass < cage.cells.length; pass += 1) {
                for (const cell of cage.cells) {
                    const touches = [cell - 6, cell + 6, cell - 1, cell + 1];
                    if (touches.some((other) => reached.has(other))) reached.add(cell);
                }
            }
            expect(reached.size).toBe(cage.cells.length);
        }

        expect(seen.size).toBe(36);
    });

    /** Two cells of the same cage may share neither a row nor a column, as in a Latin square. */
    it('solves to a Latin square', () => {
        const { solution } = generate('medium', 4242, 5);

        for (let line = 0; line < 5; line += 1) {
            const row = new Set();
            const col = new Set();
            for (let i = 0; i < 5; i += 1) {
                row.add(solution[line * 5 + i]);
                col.add(solution[i * 5 + line]);
            }
            expect(row.size).toBe(5);
            expect(col.size).toBe(5);
        }
    });

    it('labels the top-left cell of each cage and no other', () => {
        const { doc } = generate('easy', 555);
        const labelled = doc.cells
            .map((cell, idx) => (cell.label == null ? -1 : idx))
            .filter((idx) => idx >= 0);

        expect(labelled.sort((a, b) => a - b)).toEqual(
            doc.meta.cages.map((cage) => cage.cells[0]).sort((a, b) => a - b),
        );
    });

    /** A kenken has no givens: every cell is the player's to fill, including single-cell cages. */
    it('leaves every cell editable and carries no solution value in the document', () => {
        const { doc, solution } = generate('easy', 606);

        expect(doc.cells.every((cell) => cell.given == null && !cell.block)).toBe(true);
        expect(doc.cells.map((cell) => cell.given)).not.toEqual(solution);
    });

    it('reproduces the same puzzle from the same seed', () => {
        const first = generate('medium', 777, 5);
        const second = generate('medium', 777, 5);

        expect(second.doc.meta.cages).toEqual(first.doc.meta.cages);
        expect(second.solution).toEqual(first.solution);
    });

    it('generates the largest offered size within its time budget', () => {
        const started = Date.now();
        const { doc } = generate('hard', 909, 7);

        expect(countSolutions(doc.meta.cages, 7, 2)).toBe(1);
        expect(Date.now() - started).toBeLessThan(10_000);
    });

    it('rejects a grid size it does not offer', () => {
        expect(() =>
            kenken.create({ difficulty: 'easy', size: { rows: 9, cols: 9 }, rng: createRng(1) }),
        ).toThrow(RangeError);
    });
});

describe('the kenken solver', () => {
    it('builds a Latin square of the requested side', () => {
        const square = randomLatinSquare(6, createRng(11));

        for (let line = 0; line < 6; line += 1) {
            const row = new Set();
            const col = new Set();
            for (let i = 0; i < 6; i += 1) {
                row.add(square[line * 6 + i]);
                col.add(square[i * 6 + line]);
            }
            expect(row.size).toBe(6);
            expect(col.size).toBe(6);
        }
    });

    /**
     * The one thing generation must never do is ship an ambiguous puzzle, so the counter has to be
     * able to *find* ambiguity. A 4×4 with a single four-cell cage summing the whole first two rows
     * is wildly under-constrained.
     */
    it('finds more than one solution for a partition that admits them', () => {
        const cages = [
            { id: 0, cells: [0, 1, 4, 5], op: '+', target: 10 },
            { id: 1, cells: [2, 3, 6, 7], op: '+', target: 10 },
            { id: 2, cells: [8, 9, 12, 13], op: '+', target: 10 },
            { id: 3, cells: [10, 11, 14, 15], op: '+', target: 10 },
        ];

        expect(countSolutions(cages, 4, 2)).toBe(2);
    });
});

describe('kenken module interface', () => {
    it('accepts a legal digit and rejects one outside the alphabet', () => {
        const { doc } = generate('easy', 56);

        expect(kenken.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: 0, value: '3' })).toBe(
            true,
        );
        expect(kenken.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: 0, value: '7' })).toBe(
            false,
        );
    });

    it('rejects the batched fill op, which belongs to nonogram', () => {
        const { doc } = generate('easy', 57);

        expect(
            kenken.validateOp(doc, { opId: 'a', t: OP_TYPE.FILL, cells: [0, 1], value: '1' }),
        ).toBe(false);
    });

    it('reports completion only when every cell matches the solution', () => {
        const { doc, solution } = generate('easy', 58);
        const board = emptyBoard();
        solution.forEach((value, idx) => {
            board.cells[idx] = { value, marks: [], by: 'p1', seq: idx + 1 };
        });

        expect(kenken.isComplete(doc, board, solution)).toBe(true);

        board.cells[0] = { value: null, marks: [], by: 'p1', seq: 99 };
        expect(kenken.isComplete(doc, board, solution)).toBe(false);
    });

    it('classifies checked cells as correct, wrong, or empty', () => {
        const { doc, solution } = generate('easy', 59);
        const board = emptyBoard();
        board.cells[0] = { value: solution[0], marks: [], by: 'p1', seq: 1 };
        board.cells[1] = {
            value: solution[1] === '1' ? '2' : '1',
            marks: [],
            by: 'p1',
            seq: 2,
        };

        const result = kenken.checkCells(doc, board, solution, [0, 1, 2]);
        expect(result[0]).toBe('correct');
        expect(result[1]).toBe('wrong');
        expect(result[2]).toBe('empty');
    });
});
