/**
 * The one function that decides what an op means. Imported by both client and server so the two
 * cannot drift in how they interpret the same op (ADR-0001).
 *
 * Pure: no clock reads, no randomness, no mutation of its arguments.
 */

import { OP_TYPE } from './protocol.js';

/**
 * @typedef {import('./protocol.js').BoardState} BoardState
 * @typedef {import('./protocol.js').CellState} CellState
 * @typedef {import('./protocol.js').Op} Op
 */

/**
 * An empty board, before any op has been applied.
 *
 * @returns {BoardState} A board at seq 0 with no cells written.
 */
export function emptyBoard() {
    return { seq: 0, cells: {} };
}

/** The state a cell holds before anyone has written to it. */
function blankCell() {
    return { value: null, marks: [], by: null, seq: 0 };
}

/** Normalises pencil marks to a sorted, duplicate-free array so equal mark sets compare equal. */
function normalizeMarks(marks) {
    return [...new Set(marks)].sort((a, b) => a - b);
}

/**
 * Applies one op to a board and returns a new board.
 *
 * Conflicts resolve by per-cell last-writer-wins, ordered by the server-assigned seq: a write
 * carrying a lower seq than the cell already holds is dropped. That makes application
 * order-independent, which is the invariant that lets a client apply ops as they arrive and still
 * match the server's snapshot.
 *
 * @param {BoardState} board - Current board; not mutated.
 * @param {Op} op - The op to apply, already schema-validated.
 * @param {{ seq: number, by: string|null }} meta - Server stamp for this op.
 * @returns {BoardState} A new board with the op applied.
 * @throws {RangeError} If the op names no cell to write.
 */
export function applyOp(board, op, meta) {
    const targets = opTargets(op);
    if (targets.length === 0) {
        throw new RangeError(`op ${op.opId} of type ${op.t} names no cell`);
    }

    const cells = { ...board.cells };
    for (const idx of targets) {
        const current = cells[idx] ?? blankCell();
        if (current.seq > meta.seq) continue;
        cells[idx] = nextCellState(current, op, meta);
    }

    return { seq: Math.max(board.seq, meta.seq), cells };
}

/** The cell indices an op writes to, which differ by op type. */
function opTargets(op) {
    if (op.t === OP_TYPE.FILL) return op.cells ?? [];
    return op.cell == null ? [] : [op.cell];
}

/** The state a single cell takes after an op lands on it. */
function nextCellState(current, op, meta) {
    const stamp = { by: meta.by, seq: meta.seq };

    switch (op.t) {
        case OP_TYPE.SET:
        case OP_TYPE.FILL:
            // Entering a value clears that cell's pencil marks; they were notes toward it.
            return { value: op.value ?? null, marks: [], ...stamp };
        case OP_TYPE.MARKS:
            // A cell holds a value or marks, never both. That is how a cell renders, how players
            // think about it, and what lets undo restore any earlier state with a single write,
            // since it makes a cell's whole state expressible in one op.
            return { value: null, marks: normalizeMarks(op.marks ?? []), ...stamp };
        case OP_TYPE.CLEAR:
            return { value: null, marks: [], ...stamp };
        default:
            return current;
    }
}

/**
 * Toggles one pencil mark in a cell's mark set.
 *
 * Marks are set semantics, so Notes-mode input is a toggle rather than an append: pressing 4
 * twice leaves the cell as it started.
 *
 * @param {number[]} marks - The cell's current marks.
 * @param {number} digit - The mark to add or remove.
 * @returns {number[]} A new sorted, duplicate-free mark set.
 */
export function toggleMark(marks, digit) {
    const next = new Set(marks);
    if (next.has(digit)) next.delete(digit);
    else next.add(digit);
    return normalizeMarks([...next]);
}

/**
 * Applies a list of stamped ops in order, used to rebuild a view from a snapshot plus pending
 * local ops.
 *
 * @param {BoardState} board - Starting board; not mutated.
 * @param {(Op & { seq: number, by: string|null })[]} ops - Ops to apply, in order.
 * @returns {BoardState} A new board with every op applied.
 */
export function applyOps(board, ops) {
    let next = board;
    for (const op of ops) {
        next = applyOp(next, op, { seq: op.seq, by: op.by });
    }
    return next;
}
