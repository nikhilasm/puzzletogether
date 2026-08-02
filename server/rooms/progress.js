/**
 * What checking, solving, revealing, or abandoning a puzzle does to a room.
 *
 * Split out from `lifecycle.js`, which owns seats and rooms, because the streak rules in
 * design-spec.md §4 are the part of this most worth testing directly: Check is free, Reveal and
 * abandonment both reset the streak, and only a genuine solve increments it.
 *
 * Every function here reads `room.solution`, which is exactly why they live on the server and why
 * Check and Reveal are RPCs rather than client-side features.
 */

import { CHECK_STATE, ROOM_STATE } from '../../shared/protocol.js';
import { cellCount, isEditable } from '../../shared/puzzle-doc.js';

import { clearPuzzle } from './lifecycle.js';
import { touchRoom } from './store.js';

/** Every cell index a player could have written to, which is the set Check reports on. */
function editableIndices(doc) {
    const total = cellCount(doc.size);
    const indices = [];
    for (let idx = 0; idx < total; idx += 1) {
        if (isEditable(doc, idx)) indices.push(idx);
    }
    return indices;
}

/** The board a Reveal produces: every editable cell holding its solution value, at one new seq. */
function fillFromSolution(room) {
    const seq = room.board.seq + 1;
    const cells = { ...room.board.cells };

    for (const idx of editableIndices(room.doc)) {
        // `by` stays null: a revealed cell was written by the room, not by a player.
        cells[idx] = { value: room.solution[idx], marks: [], by: null, seq };
    }

    return { seq, cells };
}

/** The payload both completion paths send, differing only in `revealed` and what it did to streak. */
function toSolvedResult(room, revealed) {
    return {
        elapsedMs: Math.max(0, Date.now() - room.startedAt),
        streak: room.streak,
        assists: room.assists,
        revealed,
        board: room.board,
    };
}

/**
 * Checks every filled cell against the solution and counts one assist.
 *
 * Empty cells are omitted from the result — "you have not filled this in" is not a finding, and
 * reporting it would turn Check into a way to enumerate the grid.
 *
 * @param {import('./store.js').Room} room - The room, which must hold a puzzle.
 * @param {object} module - The puzzle module for `room.doc.type`.
 * @returns {import('../../shared/protocol.js').CheckResult} The result, minus `by`, which the
 *   handler fills in from the caller's seat.
 * @throws {TypeError} If the room has no puzzle to check.
 */
export function checkPuzzle(room, module) {
    if (!room.doc || !room.solution) throw new TypeError('no puzzle to check');

    const graded = module.checkCells(
        room.doc,
        room.board,
        room.solution,
        editableIndices(room.doc),
    );
    const cells = {};
    for (const [idx, state] of Object.entries(graded)) {
        if (state !== CHECK_STATE.EMPTY) cells[idx] = state;
    }

    room.assists += 1;
    touchRoom(room);

    return { cells, by: null, assists: room.assists, at: Date.now() };
}

/**
 * Records a genuine solve: the room's streak grows, and the puzzle stops accepting ops.
 *
 * @param {import('./store.js').Room} room - The solved room.
 * @returns {import('../../shared/protocol.js').SolvedResult} What the room is told.
 */
export function solvePuzzle(room) {
    room.state = ROOM_STATE.SOLVED;
    room.streak += 1;
    touchRoom(room);

    return toSolvedResult(room, false);
}

/**
 * Reveals the whole grid, which ends the puzzle and resets the streak.
 *
 * The board is replaced wholesale at a single new `seq` rather than replayed as ops — clients take
 * the board straight off this payload, the same way they take a snapshot.
 *
 * @param {import('./store.js').Room} room - The room, which must hold a puzzle.
 * @returns {import('../../shared/protocol.js').SolvedResult} What the room is told, `revealed`.
 * @throws {TypeError} If the room has no puzzle to reveal.
 */
export function revealPuzzle(room) {
    if (!room.doc || !room.solution) throw new TypeError('no puzzle to reveal');

    room.board = fillFromSolution(room);
    room.state = ROOM_STATE.SOLVED;
    room.assists += 1;
    room.streak = 0;
    touchRoom(room);

    return toSolvedResult(room, true);
}

/**
 * Returns a room to Puzzle Select, resetting the streak only if it walked away from an unfinished
 * puzzle (design-spec.md §4). Leaving a puzzle the room already solved costs nothing.
 *
 * @param {import('./store.js').Room} room - The room to return to select.
 * @returns {boolean} True when the streak was broken by the abandonment.
 */
export function abandonPuzzle(room) {
    const brokeStreak = room.state === ROOM_STATE.PLAYING && room.streak > 0;
    if (room.state === ROOM_STATE.PLAYING) room.streak = 0;

    clearPuzzle(room);
    return brokeStreak;
}
