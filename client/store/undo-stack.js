/**
 * A player's own edit history: which cell they changed, and what it held before.
 *
 * Undo is per-player and forward-only (design-spec.md §6). There is no global history to rewind —
 * undoing emits a *new* op restoring the earlier value, so it is an ordinary edit that everyone
 * sees. That is why this stores pre-images rather than inverse ops, and why an entry is discarded
 * when somebody else has written to the cell since: rewinding over their work would be a worse
 * surprise than doing nothing.
 */

import { UNDO_DEPTH } from '../../shared/constants.js';

/**
 * @typedef {object} CellSnapshot
 * @property {string|null} value - The cell's entered value at the time.
 * @property {number[]} marks - The cell's pencil marks at the time.
 */

/**
 * @typedef {object} UndoEntry
 * @property {number} cell - Cell index this edit touched.
 * @property {CellSnapshot} before - What the cell held before the edit.
 * @property {CellSnapshot} after - What the edit left it holding.
 */

/**
 * Whether two cell states are the same edit-wise, comparing value and marks but not who wrote them.
 *
 * @param {CellSnapshot|null|undefined} a - One cell state.
 * @param {CellSnapshot|null|undefined} b - The other.
 * @returns {boolean} True when they hold the same value and the same marks.
 */
export function sameCell(a, b) {
    if ((a?.value ?? null) !== (b?.value ?? null)) return false;

    const marksA = a?.marks ?? [];
    const marksB = b?.marks ?? [];
    return marksA.length === marksB.length && marksA.every((mark, i) => mark === marksB[i]);
}

/**
 * Reduces a board cell to the value and marks an undo entry cares about.
 *
 * @param {object|null|undefined} cellState - A cell from `BoardState.cells`, possibly absent.
 * @returns {CellSnapshot} The comparable snapshot, with an empty cell reading as blank.
 */
export function snapshotCell(cellState) {
    return { value: cellState?.value ?? null, marks: [...(cellState?.marks ?? [])] };
}

export class UndoStack {
    #entries = [];
    #limit;

    /**
     * @param {number} [limit] - How many entries to retain before dropping the oldest.
     */
    constructor(limit = UNDO_DEPTH) {
        this.#limit = limit;
    }

    /**
     * How many edits are currently undoable, which is also what decides whether Undo renders
     * enabled.
     *
     * @returns {number} Entry count.
     */
    get size() {
        return this.#entries.length;
    }

    /**
     * Records an edit this player just made.
     *
     * A no-op edit is not recorded: pressing `5` on a cell that already holds `5` should not cost
     * an undo press to walk back over.
     *
     * @param {UndoEntry} entry - The cell, and its state either side of the edit.
     * @returns {void}
     */
    record(entry) {
        if (sameCell(entry.before, entry.after)) return;

        this.#entries.push(entry);
        if (this.#entries.length > this.#limit) this.#entries.shift();
    }

    /**
     * Removes and returns the most recent entry.
     *
     * @returns {UndoEntry|null} The entry, or null when there is nothing left to undo.
     */
    pop() {
        return this.#entries.pop() ?? null;
    }

    /**
     * Drops every entry. Called whenever a new puzzle starts, since indices from the old grid mean
     * nothing on the new one.
     *
     * @returns {void}
     */
    clear() {
        this.#entries = [];
    }
}
