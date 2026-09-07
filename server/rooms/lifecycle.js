/**
 * Seats, host election, disconnect grace, and room garbage collection.
 *
 * The three prototype bugs this module exists to prevent (design-spec.md §2): players leaking into
 * rooms forever, rooms never being collected, and identity being a display-name string.
 */

import { randomBytes, randomUUID } from 'node:crypto';

import { MAX_PLAYERS_PER_ROOM, PLAYER_COLOR_COUNT } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';

import { allRooms, deleteRoom, touchRoom } from './store.js';

/**
 * @typedef {import('./store.js').Room} Room
 * @typedef {import('./store.js').Player} Player
 */

/** Lowest colour index not currently taken, so colours are reused after someone leaves. */
function nextColorIndex(room) {
    const taken = new Set([...room.players.values()].map((player) => player.colorIndex));
    for (let index = 0; index < PLAYER_COLOR_COUNT; index += 1) {
        if (!taken.has(index)) return index;
    }
    return room.players.size % PLAYER_COLOR_COUNT;
}

/**
 * Adds a new player to a room and issues their reconnect token; the first to join becomes host.
 * Names are labels: they may collide and confer nothing.
 *
 * @param {Room} room - The room being joined.
 * @param {string} name - Requested display name.
 * @param {string} socketId - The socket taking the seat.
 * @returns {{ player: Player, token: string }} The new player and their reconnect token.
 * @throws {RangeError} If the room is already full.
 */
export function addPlayer(room, name, socketId) {
    if (connectedCount(room) >= MAX_PLAYERS_PER_ROOM) {
        throw new RangeError('room is full');
    }

    const player = {
        id: randomUUID(),
        name: name.trim(),
        colorIndex: nextColorIndex(room),
        socketId,
        connected: true,
        joinedAt: Date.now(),
        graceTimer: null,
    };

    const token = randomBytes(32).toString('hex');
    room.players.set(player.id, player);
    room.tokens.set(token, player.id);
    if (!room.hostId) room.hostId = player.id;
    touchRoom(room);

    return { player, token };
}

/**
 * Reclaims a seat with a reconnect token, restoring name, colour, and host status.
 *
 * @param {Room} room - The room the token belongs to.
 * @param {string} token - The token from the client's handshake.
 * @param {string} socketId - The new socket.
 * @returns {{ player: Player, previousSocketId: string|null }|null} The restored player and the
 *   socket it displaced, or null when the token is unknown.
 */
export function restorePlayer(room, token, socketId) {
    const playerId = room.tokens.get(token);
    const player = playerId ? room.players.get(playerId) : null;
    if (!player) return null;

    const previousSocketId = player.connected ? player.socketId : null;
    cancelDrop(room, player);
    player.socketId = socketId;
    player.connected = true;
    touchRoom(room);

    return { player, previousSocketId };
}

/**
 * Marks a player disconnected and schedules their drop once the grace period expires.
 *
 * The player keeps their seat, colour, and host status throughout, which is what makes a refresh
 * mid-solve a non-event (ADR-0005).
 *
 * @param {Room} room - The room.
 * @param {string} playerId - The disconnecting player.
 * @param {number} graceMs - How long the seat is held.
 * @param {(room: Room, playerId: string) => void} onExpire - Called if the grace period runs out.
 * @returns {void}
 */
export function markDisconnected(room, playerId, graceMs, onExpire) {
    const player = room.players.get(playerId);
    if (!player) return;

    player.connected = false;
    player.socketId = null;
    touchRoom(room);

    const timer = setTimeout(() => {
        room.timers.delete(timer);
        player.graceTimer = null;
        onExpire(room, playerId);
    }, graceMs);

    room.timers.add(timer);
    player.graceTimer = timer;
}

/** Cancels a pending drop, used when a player reconnects inside their grace period. */
function cancelDrop(room, player) {
    if (!player.graceTimer) return;
    clearTimeout(player.graceTimer);
    room.timers.delete(player.graceTimer);
    player.graceTimer = null;
}

/**
 * Removes a player from a room for good, releasing their colour, token, and focus.
 *
 * @param {Room} room - The room.
 * @param {string} playerId - The player to drop.
 * @returns {boolean} True when a player was removed.
 */
export function dropPlayer(room, playerId) {
    const player = room.players.get(playerId);
    if (!player) return false;

    cancelDrop(room, player);
    room.players.delete(playerId);
    room.focus.delete(playerId);
    for (const [token, id] of room.tokens) {
        if (id === playerId) room.tokens.delete(token);
    }
    touchRoom(room);

    return true;
}

/**
 * Reassigns a player's colour, provided nobody else in the room holds it, since colour is an
 * identity the presence stripes cannot make ambiguous (brand.md §3). Re-picking your own colour is a
 * no-op that succeeds.
 *
 * @param {Room} room - The room.
 * @param {string} playerId - The player changing colour. Nobody may change anyone else's.
 * @param {number} colorIndex - Requested palette index.
 * @returns {boolean} True when the colour was taken up; false when it is already somebody else's.
 */
export function setPlayerColor(room, playerId, colorIndex) {
    const player = room.players.get(playerId);
    if (!player) return false;
    if (player.colorIndex === colorIndex) return true;

    for (const other of room.players.values()) {
        if (other.id !== playerId && other.colorIndex === colorIndex) return false;
    }

    player.colorIndex = colorIndex;
    touchRoom(room);
    return true;
}

/**
 * Promotes the longest-connected player when the room has no valid host.
 *
 * @param {Room} room - The room.
 * @returns {string|null} The new host's id, or null when the room has nobody to promote.
 */
export function electHost(room) {
    const current = room.hostId ? room.players.get(room.hostId) : null;
    if (current) return room.hostId;

    const candidates = [...room.players.values()]
        .filter((player) => player.connected)
        .sort((a, b) => a.joinedAt - b.joinedAt);

    room.hostId = candidates[0]?.id ?? null;
    return room.hostId;
}

/**
 * How many players currently hold a live socket.
 *
 * @param {Room} room - The room.
 * @returns {number} Connected player count.
 */
export function connectedCount(room) {
    let count = 0;
    for (const player of room.players.values()) {
        if (player.connected) count += 1;
    }
    return count;
}

/**
 * The client-safe view of a room.
 *
 * @param {Room} room - The room.
 * @returns {import('../../shared/protocol.js').RoomView} Everything a client may know about it.
 */
export function toRoomView(room) {
    return {
        code: room.code,
        state: room.state,
        hostId: room.hostId,
        streak: room.streak,
        settings: room.settings,
        players: [...room.players.values()].map((player) => ({
            id: player.id,
            name: player.name,
            colorIndex: player.colorIndex,
            connected: player.connected,
        })),
    };
}

/**
 * The current puzzle state for a joining or resyncing client.
 *
 * Carries doc but never solution, which is the whole reason Check and Reveal are server RPCs
 * (architecture.md §5).
 *
 * @param {Room} room - The room.
 * @returns {import('../../shared/protocol.js').Snapshot} A full board snapshot.
 */
export function toSnapshot(room) {
    return {
        doc: room.doc,
        board: room.board,
        startedAt: room.startedAt,
        serverNow: Date.now(),
        focus: Object.fromEntries(room.focus),
        assists: room.assists,
    };
}

/**
 * Starts the room garbage collector.
 *
 * Deletes rooms with nobody connected for longer than the idle limit, or older than the maximum
 * age, clearing every timer they hold first.
 *
 * @param {object} options - Sweep configuration.
 * @param {number} options.sweepIntervalMs - How often to sweep.
 * @param {number} options.idleLimitMs - Idle time after which an empty room is collected.
 * @param {number} options.maxAgeMs - Absolute room age limit.
 * @param {(room: Room, reason: 'idle'|'aged') => void} [options.onDelete] - Called with each room
 *   before it is deleted, and why it is being collected.
 * @returns {() => void} A function that stops the sweep.
 */
export function startRoomGc({ sweepIntervalMs, idleLimitMs, maxAgeMs, onDelete }) {
    // Runs one sweep, collecting every room that has gone quiet or aged out.
    function sweep() {
        const now = Date.now();
        for (const room of allRooms()) {
            const idleMs = now - room.lastActivityAt;
            const isAbandoned = connectedCount(room) === 0 && idleMs > idleLimitMs;
            const isExpired = now - room.createdAt > maxAgeMs;
            if (!isAbandoned && !isExpired) continue;

            // Age wins when a room is both: it is the limit that collects a room out from under
            // people, which is the only collection anybody is present to notice.
            onDelete?.(room, isExpired ? 'aged' : 'idle');
            deleteRoom(room.code);
        }
    }

    const interval = setInterval(sweep, sweepIntervalMs);
    interval.unref();
    return () => clearInterval(interval);
}

/**
 * Resets a room's puzzle state, used when a puzzle is abandoned or replaced.
 *
 * @param {Room} room - The room to clear.
 * @returns {void}
 */
export function clearPuzzle(room) {
    room.state = ROOM_STATE.SELECT;
    room.doc = null;
    room.solution = null;
    room.board = { seq: 0, cells: {} };
    room.startedAt = null;
    room.assists = 0;
    room.focus.clear();
    touchRoom(room);
}
