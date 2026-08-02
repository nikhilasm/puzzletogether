import { describe, expect, it } from 'vitest';

import { OP_TYPE } from '../../shared/protocol.js';

import { opForDigit, opResult, restoreOp } from './ops.js';

/** A cell snapshot, so the tests read as the states they describe. */
function cell(value, marks = []) {
    return { value, marks };
}

describe('opForDigit', () => {
    it('writes a value in Solve mode', () => {
        const op = opForDigit({
            opId: 'a-1',
            cell: 4,
            value: '7',
            isNotes: false,
            current: cell(null),
        });

        expect(op).toEqual({ opId: 'a-1', t: OP_TYPE.SET, cell: 4, value: '7' });
    });

    it('adds a pencil mark in Notes mode', () => {
        const op = opForDigit({
            opId: 'a-1',
            cell: 4,
            value: '7',
            isNotes: true,
            current: cell(null, [1, 3]),
        });

        expect(op).toEqual({ opId: 'a-1', t: OP_TYPE.MARKS, cell: 4, marks: [1, 3, 7] });
    });

    it('removes a mark that is already there, since marks are a toggle not an append', () => {
        const op = opForDigit({
            opId: 'a-1',
            cell: 4,
            value: '3',
            isNotes: true,
            current: cell(null, [1, 3]),
        });

        expect(op.marks).toEqual([1]);
    });

    it('starts a fresh mark set on a filled cell rather than hiding marks under the value', () => {
        const op = opForDigit({
            opId: 'a-1',
            cell: 4,
            value: '7',
            isNotes: true,
            current: cell('5', [1, 2]),
        });

        expect(op.marks).toEqual([7]);
    });
});

describe('restoreOp', () => {
    it('restores a value with a set', () => {
        expect(restoreOp('a-1', 4, cell('5'))).toEqual({
            opId: 'a-1',
            t: OP_TYPE.SET,
            cell: 4,
            value: '5',
        });
    });

    it('restores marks with a marks op', () => {
        expect(restoreOp('a-1', 4, cell(null, [2, 6]))).toEqual({
            opId: 'a-1',
            t: OP_TYPE.MARKS,
            cell: 4,
            marks: [2, 6],
        });
    });

    it('restores an empty cell with a clear', () => {
        expect(restoreOp('a-1', 4, cell(null))).toEqual({ opId: 'a-1', t: OP_TYPE.CLEAR, cell: 4 });
    });
});

describe('opResult', () => {
    it('agrees with the board reducer that entering a value drops the marks', () => {
        const op = { opId: 'a-1', t: OP_TYPE.SET, cell: 4, value: '7' };
        expect(opResult(op, cell(null, [1, 2]))).toEqual({ value: '7', marks: [] });
    });

    it('agrees that marks replace a value, so undo can restore any state in one op', () => {
        const op = { opId: 'a-1', t: OP_TYPE.MARKS, cell: 4, marks: [3] };
        expect(opResult(op, cell('9'))).toEqual({ value: null, marks: [3] });
    });

    it('empties the cell on clear', () => {
        const op = { opId: 'a-1', t: OP_TYPE.CLEAR, cell: 4 };
        expect(opResult(op, cell('9', [1]))).toEqual({ value: null, marks: [] });
    });
});
