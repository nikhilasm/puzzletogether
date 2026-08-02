import { describe, expect, it } from 'vitest';

import { applyOp, applyOps, emptyBoard } from './board-reducer.js';
import { OP_TYPE } from './protocol.js';

/** A `set` op, with the boilerplate filled in. */
function setOp(opId, cell, value) {
    return { opId, t: OP_TYPE.SET, cell, value };
}

describe('applyOp', () => {
    it('writes a value and stamps it with the writer and sequence', () => {
        const board = applyOp(emptyBoard(), setOp('a', 42, '5'), { seq: 1, by: 'player-1' });

        expect(board.seq).toBe(1);
        expect(board.cells[42]).toEqual({ value: '5', marks: [], by: 'player-1', seq: 1 });
    });

    it('does not mutate the board it was given', () => {
        const before = emptyBoard();
        applyOp(before, setOp('a', 0, '1'), { seq: 1, by: 'player-1' });

        expect(before).toEqual({ seq: 0, cells: {} });
    });

    it('resolves a conflict on one cell in favour of the later sequence number', () => {
        let board = applyOp(emptyBoard(), setOp('a', 7, '1'), { seq: 1, by: 'player-1' });
        board = applyOp(board, setOp('b', 7, '9'), { seq: 2, by: 'player-2' });

        expect(board.cells[7].value).toBe('9');
        expect(board.cells[7].by).toBe('player-2');
    });

    it('ignores a write that arrives behind the sequence the cell already holds', () => {
        let board = applyOp(emptyBoard(), setOp('b', 7, '9'), { seq: 2, by: 'player-2' });
        board = applyOp(board, setOp('a', 7, '1'), { seq: 1, by: 'player-1' });

        expect(board.cells[7].value).toBe('9');
    });

    it('clears pencil marks when a value lands in the cell', () => {
        let board = applyOp(
            emptyBoard(),
            { opId: 'm', t: OP_TYPE.MARKS, cell: 3, marks: [3, 1, 3] },
            { seq: 1, by: 'player-1' },
        );
        expect(board.cells[3].marks).toEqual([1, 3]);

        board = applyOp(board, setOp('v', 3, '4'), { seq: 2, by: 'player-1' });
        expect(board.cells[3].marks).toEqual([]);
    });

    it('empties a cell on clear', () => {
        let board = applyOp(emptyBoard(), setOp('a', 1, '5'), { seq: 1, by: 'player-1' });
        board = applyOp(board, { opId: 'c', t: OP_TYPE.CLEAR, cell: 1 }, { seq: 2, by: 'p2' });

        expect(board.cells[1].value).toBeNull();
    });

    it('writes every cell of a batched fill', () => {
        const op = { opId: 'f', t: OP_TYPE.FILL, cells: [1, 2, 3], value: 'x' };
        const board = applyOp(emptyBoard(), op, { seq: 1, by: 'player-1' });

        expect([1, 2, 3].map((idx) => board.cells[idx].value)).toEqual(['x', 'x', 'x']);
    });

    it('throws when an op names no cell', () => {
        expect(() =>
            applyOp(emptyBoard(), { opId: 'x', t: OP_TYPE.SET }, { seq: 1, by: null }),
        ).toThrow(RangeError);
    });
});

describe('applyOps', () => {
    /**
     * The load-bearing invariant from ADR-0001: a client that applies ops one at a time as they
     * arrive must end up with exactly the board the server would send in a snapshot — in any
     * arrival order, since ops carry their own sequence numbers.
     */
    it('matches the snapshot regardless of the order ops arrive in', () => {
        const ops = [
            { ...setOp('a', 0, '1'), seq: 1, by: 'p1' },
            { ...setOp('b', 1, '2'), seq: 2, by: 'p2' },
            { ...setOp('c', 0, '3'), seq: 3, by: 'p2' },
            { opId: 'd', t: OP_TYPE.CLEAR, cell: 1, seq: 4, by: 'p1' },
            { ...setOp('e', 2, '7'), seq: 5, by: 'p1' },
        ];

        const inOrder = applyOps(emptyBoard(), ops);
        const shuffled = applyOps(emptyBoard(), [ops[4], ops[0], ops[3], ops[2], ops[1]]);

        expect(shuffled).toEqual(inOrder);
        expect(inOrder.cells[0].value).toBe('3');
        expect(inOrder.cells[1].value).toBeNull();
        expect(inOrder.seq).toBe(5);
    });
});
