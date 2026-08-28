/**
 * Handshake identity: protocol version checking and reconnect-token restore.
 *
 * Nothing the client asserts about itself is trusted here. A token proves which seat a socket
 * holds; host status is read from the room, never from the payload (ADR-0005).
 */

import { PROTOCOL_VERSION } from '../../shared/protocol.js';
import { restorePlayer } from '../rooms/lifecycle.js';
import { getRoom } from '../rooms/store.js';

/**
 * Reads the handshake auth block a client connects with.
 *
 * @param {import('socket.io').Socket} socket - The connecting socket.
 * @returns {{ token: string|null, code: string|null, protocolVersion: number|null }} The claims
 *   the client made, unvalidated.
 */
export function readHandshake(socket) {
    const auth = socket.handshake.auth ?? {};
    return {
        token: typeof auth.token === 'string' ? auth.token : null,
        code: typeof auth.code === 'string' ? auth.code.toLowerCase() : null,
        protocolVersion: Number.isInteger(auth.protocolVersion) ? auth.protocolVersion : null,
    };
}

/**
 * Whether a client's protocol version can talk to this server.
 *
 * @param {number|null} version - The version from the handshake.
 * @returns {boolean} True when the versions match.
 */
export function isProtocolCompatible(version) {
    return version === PROTOCOL_VERSION;
}

/**
 * Attempts to restore a seat from a handshake token.
 *
 * @param {import('socket.io').Socket} socket - The connecting socket.
 * @returns {{ room: import('../rooms/store.js').Room,
 *   player: import('../rooms/store.js').Player,
 *   previousSocketId: string|null }|null} The restored seat, or null when the token or room is
 *   gone and the client must fall back to the landing screen.
 */
export function restoreSeat(socket) {
    const { token, code } = readHandshake(socket);
    if (!token || !code) return null;

    const room = getRoom(code);
    if (!room) return null;

    const restored = restorePlayer(room, token, socket.id);
    if (!restored) return null;

    return { room, ...restored };
}

/**
 * The seat a socket currently holds.
 *
 * @param {import('socket.io').Socket} socket - The socket.
 * @returns {{ room: import('../rooms/store.js').Room,
 *   player: import('../rooms/store.js').Player }|null} The seat, or null when the socket has not
 *   joined a room or its room has since been collected.
 */
export function currentSeat(socket) {
    const { code, playerId } = socket.data ?? {};
    if (!code || !playerId) return null;

    const room = getRoom(code);
    const player = room?.players.get(playerId);
    if (!room || !player) return null;

    return { room, player };
}

/**
 * Whether a player is the room's host. The single source of truth for every host-only action.
 *
 * @param {import('../rooms/store.js').Room} room - The room.
 * @param {string} playerId - The acting player.
 * @returns {boolean} True when the player currently holds the host seat.
 */
export function isHost(room, playerId) {
    return room.hostId === playerId;
}
