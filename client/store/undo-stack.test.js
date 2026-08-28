import { describe, expect, it } from 'vitest';

import { UndoStack, sameCell, snapshotCell } from './undo-stack.js';

/** A cell snapshot, so the tests read as the states they describe rather than as object literals. */
function cell(value, marks = []) {
    return { value, marks };
}

describe('sameCell', () => {
    it('treats an absent cell and an empty one as the same state', () => {
        expect(sameCell(null, cell(null))).toBe(true);
        expect(sameCell(undefined, { value: null, marks: [] })).toBe(true);
    });

    it('separates a value change', () => {
        expect(sameCell(cell('4'), cell('5'))).toBe(false);
    });

    it('separates a mark change, which is what makes Notes-mode edits undoable', () => {
        expect(sameCell(cell(null, [1, 2]), cell(null, [1, 2, 3]))).toBe(false);
        expect(sameCell(cell(null, [1, 2]), cell(null, [1, 2]))).toBe(true);
    });
});

describe('snapshotCell', () => {
    it('reduces a board cell to value and marks, dropping the stamp', () => {
        const state = { value: '7', marks: [1, 2], by: 'someone', seq: 12 };
        expect(snapshotCell(state)).toEqual({ value: '7', marks: [1, 2] });
    });

    it('copies the marks rather than aliasing them, so a later op cannot rewrite history', () => {
        const marks = [1, 2];
        const snapshot = snapshotCell({ value: null, marks });
        marks.push(3);
        expect(snapshot.marks).toEqual([1, 2]);
    });

    it('reads a missing cell as blank', () => {
        expect(snapshotCell(undefined)).toEqual({ value: null, marks: [] });
    });
});

describe('UndoStack', () => {
    it('returns the most recent edit first', () => {
        const stack = new UndoStack();
        stack.record({ cell: 1, before: cell(null), after: cell('4') });
        stack.record({ cell: 2, before: cell(null), after: cell('9') });

        expect(stack.pop().cell).toBe(2);
        expect(stack.pop().cell).toBe(1);
        expect(stack.pop()).toBeNull();
    });

    it('ignores an edit that changed nothing, so Undo never costs a wasted press', () => {
        const stack = new UndoStack();
        stack.record({ cell: 1, before: cell('4'), after: cell('4') });

        expect(stack.size).toBe(0);
    });

    it('drops the oldest entry once it is full rather than growing without bound', () => {
        const stack = new UndoStack(2);
        stack.record({ cell: 1, before: cell(null), after: cell('1') });
        stack.record({ cell: 2, before: cell(null), after: cell('2') });
        stack.record({ cell: 3, before: cell(null), after: cell('3') });

        expect(stack.size).toBe(2);
        expect(stack.pop().cell).toBe(3);
        expect(stack.pop().cell).toBe(2);
        expect(stack.pop()).toBeNull();
    });

    it('empties on clear, which is what a new puzzle does to old cell indices', () => {
        const stack = new UndoStack();
        stack.record({ cell: 1, before: cell(null), after: cell('1') });
        stack.clear();

        expect(stack.size).toBe(0);
        expect(stack.pop()).toBeNull();
    });
});
