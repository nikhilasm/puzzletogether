/**
 * The in-memory room map and the only module that touches it (ADR-0002).
 *
 * Every room carries createdAt, lastActivityAt, and a timers set, so the garbage collector
 * in lifecycle.js can delete a room without leaking a single timer, the defect that made the
 * prototype's rooms immortal.
 */

import { emptyBoard } from '../../shared/board-reducer.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';

import { generateRoomCode } from './codes.js';

/**
 * @typedef {object} Player
 * @property {string} id - Server-assigned player id, stable for the room's lifetime.
 * @property {string} name - Display name; a label with no authority.
 * @property {number} colorIndex - Index into the player palette.
 * @property {string|null} socketId - Currently attached socket, or null while disconnected.
 * @property {boolean} connected - False during the disconnect grace period.
 * @property {number} joinedAt - When the player first joined; host election uses it.
 * @property {NodeJS.Timeout|null} graceTimer - Pending drop timer while disconnected.
 */

/**
 * @typedef {object} Room
 * @property {string} code - The 4-character room code.
 * @property {string} state - One of ROOM_STATE.
 * @property {string|null} hostId - Current host's playerId.
 * @property {number} createdAt - Creation timestamp.
 * @property {number} lastActivityAt - Last time anything happened in the room.
 * @property {object} settings - Puzzle type, difficulty, size, and assist permissions.
 * @property {Map<string, Player>} players - Seats, connected or in their grace period.
 * @property {Map<string, string>} tokens - Reconnect token to playerId (ADR-0005).
 * @property {number} streak - Consecutive puzzles solved by this room.
 * @property {import('../../shared/protocol.js').PuzzleDoc|null} doc - Current puzzle.
 * @property {string[]|null} solution - Current solution. Never serialised to a client.
 * @property {import('../../shared/protocol.js').BoardState} board - Authoritative board.
 * @property {number|null} startedAt - When the current puzzle began.
 * @property {number} assists - Check and Reveal uses this puzzle.
 * @property {Map<string, number>} focus - playerId to the cell they have focused.
 * @property {Set<NodeJS.Timeout>} timers - Every timer the room owns, cleared on delete.
 */

/** @type {Map<string, Room>} */
const ROOMS = new Map();

/**
 * Creates an empty room in the select state and stores it.
 *
 * @returns {Room} The new room, with a unique code and no players yet.
 */
export function createRoom() {
    const now = Date.now();
    const room = {
        code: generateRoomCode((code) => ROOMS.has(code)),
        state: ROOM_STATE.SELECT,
        hostId: null,
        createdAt: now,
        lastActivityAt: now,
        settings: { ...DEFAULT_SETTINGS },
        players: new Map(),
        tokens: new Map(),
        streak: 0,
        doc: null,
        solution: null,
        board: emptyBoard(),
        startedAt: null,
        assists: 0,
        focus: new Map(),
        // Which banked puzzles this room has already been handed. A generator never repeats, so this
        // stays empty for three of the four types; a bank of thirty runs out, and being given back
        // the puzzle you just solved reads as the button being broken (design-spec.md §7).
        served: new Set(),
        timers: new Set(),
    };

    ROOMS.set(room.code, room);
    return room;
}

/**
 * Looks a room up by code.
 *
 * @param {string} code - The room code, lowercase.
 * @returns {Room|null} The room, or null when no such room exists.
 */
export function getRoom(code) {
    return ROOMS.get(code) ?? null;
}

/**
 * Deletes a room and clears every timer it owns.
 *
 * @param {string} code - The room code.
 * @returns {boolean} True when a room was deleted.
 */
export function deleteRoom(code) {
    const room = ROOMS.get(code);
    if (!room) return false;

    for (const timer of room.timers) clearTimeout(timer);
    room.timers.clear();
    return ROOMS.delete(code);
}

/**
 * Every live room, for the garbage collector.
 *
 * @returns {Room[]} A snapshot array, safe to iterate while deleting.
 */
export function allRooms() {
    return [...ROOMS.values()];
}

/**
 * How many rooms are currently held.
 *
 * @returns {number} The room count.
 */
export function roomCount() {
    return ROOMS.size;
}

/**
 * Records that something happened in a room, which keeps the garbage collector away from it.
 *
 * @param {Room} room - The room to touch.
 * @returns {void}
 */
export function touchRoom(room) {
    room.lastActivityAt = Date.now();
}
