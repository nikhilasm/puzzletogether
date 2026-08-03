/**
 * Builds the ops a player's input produces, and says what each one will leave in its cell.
 *
 * Pure and socket-free so that the undo path is testable on its own: `opResult` is what lets the
 * store record an edit's *after* state before the server has confirmed anything, and `restoreOp`
 * is what turns an undo entry back into an ordinary forward op (design-spec.md §6).
 */

import { toggleMark } from '../../shared/board-reducer.js';
import { OP_TYPE } from '../../shared/protocol.js';

/**
 * @typedef {import('../../shared/protocol.js').Op} Op
 * @typedef {import('./undo-stack.js').CellSnapshot} CellSnapshot
 */

/**
 * Writes a value into a cell.
 *
 * @param {string} opId - Client-unique op id.
 * @param {number} cell - Cell index.
 * @param {string} value - The value to write.
 * @returns {Op} A `set` op.
 */
export function setOp(opId, cell, value) {
    return { opId, t: OP_TYPE.SET, cell, value };
}

/**
 * Empties a cell of both its value and its marks.
 *
 * @param {string} opId - Client-unique op id.
 * @param {number} cell - Cell index.
 * @returns {Op} A `clear` op.
 */
export function clearOp(opId, cell) {
    return { opId, t: OP_TYPE.CLEAR, cell };
}

/**
 * Writes one value across many cells at once — what a nonogram drag becomes.
 *
 * Batched rather than sent per cell so that painting a run is one write, one echo, and one undo step
 * for everybody in the room, instead of twenty of each racing each other over the wire.
 *
 * @param {string} opId - Client-unique op id.
 * @param {number[]} cells - Cell indices to write.
 * @param {string|null} value - The value to write, or null to empty them.
 * @returns {Op} A `fill` op.
 */
export function fillOp(opId, cells, value) {
    return { opId, t: OP_TYPE.FILL, cells, value };
}

/**
 * Replaces a cell's pencil marks wholesale — marks are set semantics, not an append log.
 *
 * @param {string} opId - Client-unique op id.
 * @param {number} cell - Cell index.
 * @param {number[]} marks - The complete new mark set.
 * @returns {Op} A `marks` op.
 */
export function marksOp(opId, cell, marks) {
    return { opId, t: OP_TYPE.MARKS, cell, marks };
}

/**
 * The op a digit press produces, given the input mode and what the cell already holds.
 *
 * This is the single input path design-spec.md §11 asks for: physical keyboard, on-screen keypad,
 * and touch all arrive here, and the Notes/Solve branch happens once.
 *
 * @param {object} input - The keypress in context.
 * @param {string} input.opId - Client-unique op id.
 * @param {number} input.cell - Cell index.
 * @param {string} input.value - The digit pressed.
 * @param {boolean} input.isNotes - True when the room's toggle is on Notes.
 * @param {CellSnapshot} input.current - What the cell holds now.
 * @returns {Op|null} The op to send, or null when the press means nothing here.
 */
export function opForDigit({ opId, cell, value, isNotes, current }) {
    if (!isNotes) return setOp(opId, cell, value);

    const digit = Number.parseInt(value, 10);
    if (!Number.isInteger(digit)) return null;

    // Noting in a filled cell replaces the value, so the marks start fresh rather than continuing
    // a set the player cannot see.
    const marks = current.value == null ? current.marks : [];
    return marksOp(opId, cell, toggleMark(marks, digit));
}

/**
 * The op that puts a cell back the way an undo entry remembers it.
 *
 * @param {string} opId - Client-unique op id.
 * @param {number} cell - Cell index.
 * @param {CellSnapshot} before - The state to restore.
 * @returns {Op} A `set`, `marks`, or `clear` op, whichever reproduces `before`.
 */
export function restoreOp(opId, cell, before) {
    if (before.value != null) return setOp(opId, cell, before.value);
    if (before.marks.length > 0) return marksOp(opId, cell, [...before.marks]);
    return clearOp(opId, cell);
}

/**
 * What a cell will hold once an op is applied to it, without going through the board reducer.
 *
 * @param {Op} op - The op about to be sent.
 * @param {CellSnapshot} current - What the cell holds now.
 * @returns {CellSnapshot} The state the op produces.
 */
export function opResult(op, current) {
    switch (op.t) {
        case OP_TYPE.SET:
        case OP_TYPE.FILL:
            // Entering a value clears the cell's marks; they were notes toward it.
            return { value: op.value ?? null, marks: [] };
        case OP_TYPE.MARKS:
            // Matches the reducer: a cell holds a value or marks, never both.
            return { value: null, marks: [...(op.marks ?? [])] };
        case OP_TYPE.CLEAR:
            return { value: null, marks: [] };
        default:
            return current;
    }
}
