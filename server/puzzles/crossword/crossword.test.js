/**
 * The crossword module and the numbering it is built on.
 *
 * Numbering gets the most attention here because it is the one piece of crossword logic that is
 * *derived* rather than stored, and because getting it wrong produces a puzzle that looks entirely
 * normal and cannot be solved: the clues silently belong to the wrong squares.
 */

import { describe, expect, it } from 'vitest';

import { MAX_CELL_VALUE_LENGTH } from '../../../shared/constants.js';
import { OP_TYPE } from '../../../shared/protocol.js';

import crossword, { ALPHABET, DOC_VERSION } from './index.js';
import { checkNumbering, numberGrid } from './numbering.js';

/** Builds a block array from a picture, where # is a black square. */
function gridOf(rows) {
    return {
        size: { rows: rows.length, cols: rows[0].length },
        blocks: rows.flatMap((row) => [...row].map((char) => char === '#')),
    };
}

/** A minimal document around a grid, for the ops and completion tests. */
function docOf(rows, answers = null) {
    const { size, blocks } = gridOf(rows);
    const { labels, entries } = numberGrid(blocks, size);

    return {
        id: 'test',
        type: 'crossword',
        version: DOC_VERSION,
        size,
        difficulty: 'easy',
        title: null,
        author: null,
        source: 'bank',
        seed: null,
        cells: blocks.map((block, idx) => ({ block, given: null, label: labels[idx] })),
        meta: {
            entries: entries.map((entry) => ({ ...entry, clue: `clue ${entry.num}${entry.dir}` })),
            alphabet: ALPHABET,
            circled: [],
            answers,
        },
    };
}

describe('numberGrid', () => {
    it('numbers the corner-blocked mini exactly as the seed puzzles are numbered', () => {
        const { size, blocks } = gridOf(['#...#', '.....', '.....', '.....', '#...#']);
        const { labels, entries } = numberGrid(blocks, size);

        expect(
            labels.map((label, idx) => (label ? `${idx}:${label}` : null)).filter(Boolean),
        ).toEqual(['1:1', '2:2', '3:3', '5:4', '9:5', '10:6', '15:7', '21:8']);
        expect(entries).toHaveLength(10);
    });

    /**
     * Across before Down at the same number is not cosmetic: it is the order .puz stores its clue
     * list in, so the importer pairs clues to entries by walking the two lists together. Reverse it
     * and every clue after the first shared number lands on the wrong entry.
     */
    it('orders entries by number, Across before Down', () => {
        const { size, blocks } = gridOf(['...', '...', '...']);
        const { entries } = numberGrid(blocks, size);

        // A number is spent on the first square that starts anything, so an open 3×3 runs 1 to 5:
        // the whole top row starts Down entries, and only the left column starts further Acrosses.
        expect(entries.map((entry) => `${entry.num}${entry.dir}`)).toEqual([
            '1A',
            '1D',
            '2D',
            '3D',
            '4A',
            '5A',
        ]);
    });

    /**
     * A square wedged between two blocks starts nothing. It is not a one-letter word, it has no
     * clue, and numbering it would put an entry in the list that no clue could ever fill.
     */
    it('does not number a square that begins no word', () => {
        const { size, blocks } = gridOf(['#.#', '...', '#.#']);
        const { labels, entries } = numberGrid(blocks, size);

        // The lone square at the top of column 1 starts a Down entry but no Across one.
        expect(entries.map((entry) => `${entry.num}${entry.dir}`)).toEqual(['1D', '2A']);
        expect(labels[0]).toBeNull();
        expect(labels[2]).toBeNull();
    });

    it('handles a grid that is not square, which real crosswords are not', () => {
        const { size, blocks } = gridOf(['....', '....', '....']);
        const { entries } = numberGrid(blocks, size);

        expect(size).toEqual({ rows: 3, cols: 4 });
        expect(entries.filter((entry) => entry.dir === 'A')).toHaveLength(3);
        expect(entries.filter((entry) => entry.dir === 'D')).toHaveLength(4);
        expect(entries.find((entry) => entry.dir === 'D').cells).toEqual([0, 4, 8]);
    });

    it('refuses a block list that is not the shape it was given', () => {
        expect(() => numberGrid([false, false], { rows: 5, cols: 5 })).toThrow(RangeError);
    });
});

describe('checkNumbering', () => {
    it('passes a document that numbers itself correctly', () => {
        expect(checkNumbering(docOf(['#...#', '.....', '.....', '.....', '#...#']))).toBeNull();
    });

    /**
     * The boot-time half of writing the numbering once. This is the failure it exists to catch: a
     * file whose stored entries no longer describe its own grid, which is not a crash but an
     * unsolvable puzzle discovered by a room mid-solve.
     */
    it('catches an entry pointing at the wrong squares', () => {
        const doc = docOf(['...', '...', '...']);
        doc.meta.entries[0].cells = [0, 1];
        expect(checkNumbering(doc)).toMatch(/should cover cells/);
    });

    it('catches a grid whose black squares moved under its entry list', () => {
        const doc = docOf(['...', '...', '...']);
        doc.cells[4].block = true;
        expect(checkNumbering(doc)).toMatch(/entries/);
    });

    it('catches a label that does not match the numbering', () => {
        const doc = docOf(['...', '...', '...']);
        doc.cells[0].label = '9';
        expect(checkNumbering(doc)).toMatch(/should be labelled/);
    });

    it('catches an entry with no clue, which is a puzzle nobody can start', () => {
        const doc = docOf(['...', '...', '...']);
        doc.meta.entries[2].clue = '';
        expect(checkNumbering(doc)).toMatch(/has no clue/);
    });
});

describe('crossword.validateOp', () => {
    const doc = docOf(['#...#', '.....', '.....', '.....', '#...#']);
    const op = (fields) => ({ opId: 'x', ...fields });

    it('accepts a single letter of its alphabet', () => {
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.SET, cell: 1, value: 'A' }))).toBe(true);
    });

    /** The point of ADR-0007: a square may hold a whole word, which is what a rebus is. */
    it('accepts a rebus up to the cell-value bound', () => {
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.SET, cell: 1, value: 'HAND' }))).toBe(
            true,
        );
        const longest = 'A'.repeat(MAX_CELL_VALUE_LENGTH);
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.SET, cell: 1, value: longest }))).toBe(
            true,
        );
    });

    it('refuses a value past the bound, which the schema also refuses', () => {
        const tooLong = 'A'.repeat(MAX_CELL_VALUE_LENGTH + 1);
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.SET, cell: 1, value: tooLong }))).toBe(
            false,
        );
    });

    it('refuses anything that is not plain letters', () => {
        for (const value of ['1', 'a', 'HA9D', 'HA ND', '']) {
            expect(
                crossword.validateOp(doc, op({ t: OP_TYPE.SET, cell: 1, value })),
                `value ${JSON.stringify(value)}`,
            ).toBe(false);
        }
    });

    it('refuses a write to a black square', () => {
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.SET, cell: 0, value: 'A' }))).toBe(false);
    });

    /** A crossword has no pencil marks and no drag-painting, so neither op means anything here. */
    it('refuses marks and batched fills outright', () => {
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.MARKS, cell: 1, marks: [1] }))).toBe(
            false,
        );
        expect(crossword.validateOp(doc, op({ t: OP_TYPE.FILL, cells: [1], value: 'A' }))).toBe(
            false,
        );
    });
});

describe('crossword completion', () => {
    const doc = docOf(['...', '...', '...']);
    const solution = [...'CATAREEAR'];
    const boardOf = (values) => ({
        seq: 1,
        cells: Object.fromEntries(
            values.map((value, idx) => [idx, { value, marks: [], by: null, seq: 1 }]),
        ),
    });

    it('is complete when every square matches, letters being no different from digits', () => {
        expect(crossword.isComplete(doc, boardOf(solution), solution)).toBe(true);
        expect(crossword.isComplete(doc, boardOf([...'XATAREEAR']), solution)).toBe(false);
    });

    /** A rebus square compares as a whole string, which is the same === at a different length. */
    it('compares a rebus square against its whole answer', () => {
        const rebus = ['HAND', ...solution.slice(1)];
        expect(crossword.isComplete(doc, boardOf(rebus), rebus)).toBe(true);
        expect(crossword.isComplete(doc, boardOf(['HAN', ...solution.slice(1)]), rebus)).toBe(
            false,
        );
    });

    it('grades filled squares and says nothing about empty ones', () => {
        const board = boardOf(['C', 'X', null, ...new Array(6).fill(null)]);
        expect(crossword.checkCells(doc, board, solution, [0, 1, 2])).toEqual({
            0: 'correct',
            1: 'wrong',
            2: 'empty',
        });
    });
});
