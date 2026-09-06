import { describe, expect, it } from 'vitest';

import { emptyBoard } from '../../../shared/board-reducer.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { createRng } from '../rng.js';

import { countSolutions } from './solver.js';

import suguru from './index.js';

/**
 * How many puzzles the invariant checks generate. Phase 5 raises this to the 200 per type the spec
 * calls for; it stays low here so the suite runs in a second.
 */
const SAMPLE_SIZE = 10;

/** Generates a puzzle from an explicit seed. */
function generate(difficulty, seed, n = 6) {
    return suguru.create({
        difficulty,
        size: { rows: n, cols: n },
        rng: createRng(seed),
    });
}

/** Every orthogonal or diagonal neighbor of a flat index, clipped to the grid. */
function king(idx, n) {
    const row = Math.floor(idx / n);
    const col = idx % n;
    const list = [];
    for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= n || c < 0 || c >= n) continue;
            list.push(r * n + c);
        }
    }
    return list;
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

describe('suguru generation', () => {
    it.each(['easy', 'medium', 'hard'])(
        'produces %s puzzles with exactly one solution',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc } = generate(difficulty, 1000 + i);
                const { count, complete } = countSolutions(toGrid(doc), doc.meta.regions, 6, 2);

                expect(complete, `puzzle ${i} did not settle within budget`).toBe(true);
                expect(count).toBe(1);
            }
        },
    );

    it('covers every cell exactly once, in connected regions', () => {
        const { doc } = generate('medium', 4141, 7);
        const seen = new Set();

        for (const region of doc.meta.regions) {
            for (const cell of region.cells) {
                expect(seen.has(cell), `cell ${cell} is in two regions`).toBe(false);
                seen.add(cell);
            }
            const reached = new Set([region.cells[0]]);
            for (let pass = 0; pass < region.cells.length; pass += 1) {
                for (const cell of region.cells) {
                    const touches = [cell - 7, cell + 7, cell - 1, cell + 1];
                    if (touches.some((other) => reached.has(other))) reached.add(cell);
                }
            }
            expect(reached.size).toBe(region.cells.length);
        }

        expect(seen.size).toBe(49);
    });

    it('gives every region a permutation of 1..its own size in the solution', () => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { doc, solution } = generate('hard', 2000 + i, 6);

            for (const region of doc.meta.regions) {
                const values = region.cells.map((idx) => Number(solution[idx])).sort();
                expect(values).toEqual(
                    Array.from({ length: region.cells.length }, (_unused, v) => v + 1),
                );
            }
        }
    });

    it('never lets identical digits touch, orthogonally or diagonally', () => {
        for (let i = 0; i < SAMPLE_SIZE; i += 1) {
            const { solution } = generate('medium', 3000 + i, 6);

            for (let idx = 0; idx < solution.length; idx += 1) {
                for (const neighbor of king(idx, 6)) {
                    if (neighbor <= idx) continue;
                    expect(solution[neighbor]).not.toBe(solution[idx]);
                }
            }
        }
    });

    it.each(['easy', 'medium', 'hard'])(
        'labels %s puzzles with their measured rating',
        (difficulty) => {
            for (let i = 0; i < SAMPLE_SIZE; i += 1) {
                const { doc } = generate(difficulty, 5000 + i);
                expect(['easy', 'medium', 'hard']).toContain(doc.difficulty);
            }
        },
    );

    it('reproduces the same puzzle from the same seed', () => {
        const first = generate('medium', 777);
        const second = generate('medium', 777);

        expect(second.doc.cells).toEqual(first.doc.cells);
        expect(second.doc.meta).toEqual(first.doc.meta);
        expect(second.solution).toEqual(first.solution);
    });

    it('never puts a solution value in the document it sends clients', () => {
        const { doc, solution } = generate('hard', 31337);
        const blanks = doc.cells.filter((cell) => cell.given == null);

        expect(blanks.length).toBeGreaterThan(0);
        expect(doc.cells.map((cell) => cell.given)).not.toEqual(solution);
    });

    it('rejects a grid size it does not offer', () => {
        expect(() =>
            suguru.create({ difficulty: 'easy', size: { rows: 3, cols: 3 }, rng: createRng(1) }),
        ).toThrow(RangeError);
        expect(() =>
            suguru.create({ difficulty: 'easy', size: { rows: 6, cols: 7 }, rng: createRng(1) }),
        ).toThrow(RangeError);
    });

    /**
     * The largest offered size at hard is the slowest case there is: hard's region pool leans
     * smallest (ADR-0021), and a 9×9 gives a partition the most chances to hit an unfillable
     * pocket. Measured worst case across a real run is under two seconds, which the pre-warmed pool
     * absorbs the way it already absorbs kenken's and kakuro's own worst cases.
     */
    it('generates the largest offered size within its time budget', () => {
        const started = Date.now();
        generate('hard', 909, 9);
        expect(Date.now() - started).toBeLessThan(10_000);
    });

    /**
     * The regression ADR-0021's Revisions record. Hard's original region pool was measured at 6×6
     * and collapsed at the sizes above it, drawing partitions that are provably unfillable rather
     * than merely slow: 9 of 25 hard 9×9 requests came back with no puzzle at all, which the caller
     * then dereferenced. A few seeds at the two sizes that failed is enough to catch a pool that
     * has stopped filling, since the old one filled 0 of 300 draws at either.
     */
    it.each([8, 9])('generates a hard %d×%d on every seed, not just lucky ones', (n) => {
        for (let seed = 0; seed < 4; seed += 1) {
            const { doc } = generate('hard', 8100 + seed, n);
            expect(doc.cells.some((cell) => cell.given == null)).toBe(true);
            expect(doc.cells.some((cell) => cell.given != null)).toBe(true);
        }
    });
});

describe('suguru module interface', () => {
    it('rejects an op targeting a given', () => {
        const { doc } = generate('easy', 55);
        const givenIdx = doc.cells.findIndex((cell) => cell.given != null);

        expect(
            suguru.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: givenIdx, value: '1' }),
        ).toBe(false);
    });

    it("rejects a value larger than the target cell's own region, even inside the alphabet", () => {
        const { doc } = generate('easy', 56, 7);
        const sizeOf = new Uint8Array(doc.size.rows * doc.size.cols);
        for (const region of doc.meta.regions) {
            for (const cell of region.cells) sizeOf[cell] = region.cells.length;
        }
        const blankIdx = doc.cells.findIndex(
            (cell, idx) => cell.given == null && sizeOf[idx] < doc.meta.alphabet.length,
        );
        expect(blankIdx).toBeGreaterThanOrEqual(0);

        const tooLarge = String(sizeOf[blankIdx] + 1);
        expect(doc.meta.alphabet.includes(tooLarge)).toBe(true);
        expect(
            suguru.validateOp(doc, { opId: 'a', t: OP_TYPE.SET, cell: blankIdx, value: tooLarge }),
        ).toBe(false);
    });

    it("accepts a value up to the target cell's own region size", () => {
        const { doc } = generate('easy', 57);
        const blankIdx = doc.cells.findIndex((cell) => cell.given == null);
        const region = doc.meta.regions.find((r) => r.cells.includes(blankIdx));

        expect(
            suguru.validateOp(doc, {
                opId: 'a',
                t: OP_TYPE.SET,
                cell: blankIdx,
                value: String(region.cells.length),
            }),
        ).toBe(true);
    });

    it('rejects the batched fill op, which belongs to nonogram', () => {
        const { doc } = generate('easy', 58);

        expect(
            suguru.validateOp(doc, { opId: 'a', t: OP_TYPE.FILL, cells: [0, 1], value: '1' }),
        ).toBe(false);
    });

    it('reports completion only when every cell matches the solution', () => {
        const { doc, solution } = generate('easy', 59);
        const board = solvedBoard(doc, solution);

        expect(suguru.isComplete(doc, board, solution)).toBe(true);

        const blankIdx = doc.cells.findIndex((cell) => cell.given == null);
        board.cells[blankIdx] = { value: null, marks: [], by: 'p1', seq: 99 };
        expect(suguru.isComplete(doc, board, solution)).toBe(false);
    });

    it('classifies checked cells as correct, wrong, or empty', () => {
        const { doc, solution } = generate('easy', 60);
        const blanks = doc.cells
            .map((cell, idx) => (cell.given == null ? idx : -1))
            .filter((idx) => idx >= 0);
        const [correctIdx, wrongIdx, emptyIdx] = blanks;

        const board = emptyBoard();
        board.cells[correctIdx] = { value: solution[correctIdx], marks: [], by: 'p1', seq: 1 };
        const region = doc.meta.regions.find((r) => r.cells.includes(wrongIdx));
        const wrongValue = solution[wrongIdx] === '1' && region.cells.length > 1 ? '2' : '1';
        board.cells[wrongIdx] = { value: wrongValue, marks: [], by: 'p1', seq: 2 };

        const result = suguru.checkCells(doc, board, solution, [correctIdx, wrongIdx, emptyIdx]);
        expect(result[correctIdx]).toBe('correct');
        expect(result[wrongIdx]).toBe('wrong');
        expect(result[emptyIdx]).toBe('empty');
    });
});
