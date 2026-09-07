/**
 * Every socket event handler, and the only place room state is mutated in response to a client,
 * always in the same order: validate the payload, resolve the seat, authorize, then act
 * (code-style.md §8). Handlers reply with a structured ack and never throw, since a throw kills the
 * connection.
 */

import { applyOp } from '../../shared/board-reducer.js';
import { ASSIST_RATE_LIMIT, FOCUS_RATE_LIMIT, OP_RATE_LIMIT } from '../../shared/constants.js';
import {
    CLIENT_EVENT,
    ERROR,
    PROTOCOL_VERSION,
    ROOM_STATE,
    SERVER_EVENT,
    fail,
    ok,
} from '../../shared/protocol.js';
import { validate } from '../../shared/schema.js';
import { config } from '../config.js';
import { log } from '../log.js';
import { catalog, getPuzzle, getPuzzleModule, prewarm } from '../puzzles/provider.js';
import {
    addPlayer,
    dropPlayer,
    electHost,
    markDisconnected,
    setPlayerColor,
    toRoomView,
    toSnapshot,
} from '../rooms/lifecycle.js';
import { abandonPuzzle, checkPuzzle, revealPuzzle, solvePuzzle } from '../rooms/progress.js';
import { createRoom, getRoom, roomCount, touchRoom } from '../rooms/store.js';

import { currentSeat, isHost, isProtocolCompatible, readHandshake, restoreSeat } from './auth.js';
import { createBuckets } from './ratelimit.js';

/** Pushes the current roster to everyone in a room. */
function broadcastPlayers(io, room) {
    io.to(room.code).emit(SERVER_EVENT.ROOM_PLAYERS, toRoomView(room).players);
}

/** Pushes the full room view, used when state, settings, or host changes. */
function broadcastRoom(io, room) {
    io.to(room.code).emit(SERVER_EVENT.ROOM_STATE, toRoomView(room));
}

/** Everything a client needs on joining or reconnecting. */
function joinPayload(room, player, token) {
    return {
        code: room.code,
        playerId: player.id,
        playerToken: token,
        room: toRoomView(room),
        snapshot: toSnapshot(room),
        // What this build can serve. Fixed for the life of the process, being the generators plus
        // whatever the bank was loaded with, so it rides the one payload a client gets exactly
        // once rather than every room:state that cannot have changed it (design-spec.md §10).
        catalog: catalog(),
    };
}

/** Attaches a socket to a room's broadcast channel and records its seat. */
function takeSeat(socket, room, player) {
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    socket.join(room.code);
}

/**
 * Ends a seat for good, re-electing a host if it was theirs. Every deliberate ending comes through
 * here (leaving, being removed, grace expiry), and reason is what tells the three apart afterwards
 * (design-spec.md §2).
 *
 * @param {object} ending - The seat and why it is ending.
 * @param {import('socket.io').Server} ending.io - The Socket.IO server, for the roster broadcast.
 * @param {import('../rooms/store.js').Room} ending.room - The room the seat is in.
 * @param {string} ending.playerId - The player losing the seat.
 * @param {'left'|'kicked'|'grace_expired'} ending.reason - What ended it.
 * @param {string} [ending.by] - The host who removed them, when somebody else decided it.
 * @returns {void}
 */
function releaseSeat({ io, room, playerId, reason, by }) {
    const name = room.players.get(playerId)?.name;
    if (!dropPlayer(room, playerId)) return;

    const previousHostId = room.hostId;
    if (previousHostId === playerId) room.hostId = null;
    const hostId = electHost(room);

    log.info('player.dropped', {
        roomCode: room.code,
        playerId,
        name,
        reason,
        by,
        players: room.players.size,
    });
    if (hostId && hostId !== previousHostId) {
        log.info('host.elected', { roomCode: room.code, playerId: hostId, previousHostId });
    }

    broadcastRoom(io, room);
}

/**
 * Resolves the caller's seat, acking a structured error when they hold none.
 *
 * Every handler past room:join needs this as its first step, which is why it is a helper rather
 * than four repeated lines.
 */
function seatOrFail(socket, ack) {
    const seat = currentSeat(socket);
    if (!seat) {
        ack(fail(ERROR.NOT_IN_ROOM, 'you are not in a room'));
        return null;
    }
    return seat;
}

/**
 * Wraps a handler with payload validation and error containment, so no handler has to repeat
 * either.
 */
function guard(socket, event, handler) {
    return async (payload, callback) => {
        const ack = typeof callback === 'function' ? callback : () => {};
        const body = payload ?? {};

        const result = validate(event, body);
        if (!result.ok) {
            ack(fail(ERROR.BAD_PAYLOAD, result.message));
            return;
        }

        try {
            await handler(body, ack);
        } catch (error) {
            // The seat is on the record because an internal failure naming only its event says
            // nothing about which room stopped working.
            log.error('handler.failed', {
                event,
                roomCode: socket.data?.code ?? null,
                playerId: socket.data?.playerId ?? null,
                err: error,
            });
            ack(fail(ERROR.INTERNAL, 'the server could not complete that request'));
        }
    };
}

/**
 * Registers every handler for one socket.
 *
 * @param {import('socket.io').Server} io - The Socket.IO server, for broadcasts.
 * @param {import('socket.io').Socket} socket - The freshly connected socket.
 * @returns {void}
 */
export function registerHandlers(io, socket) {
    const buckets = createBuckets({
        op: OP_RATE_LIMIT,
        focus: FOCUS_RATE_LIMIT,
        assist: ASSIST_RATE_LIMIT,
    });

    // Creates a room and seats the caller as its host.
    socket.on(
        CLIENT_EVENT.ROOM_CREATE,
        guard(socket, CLIENT_EVENT.ROOM_CREATE, (payload, ack) => {
            const room = createRoom();
            const { player, token } = addPlayer(room, payload.name, socket.id);
            takeSeat(socket, room, player);
            ack(ok(joinPayload(room, player, token)));
            broadcastRoom(io, room);
            log.info('room.created', {
                roomCode: room.code,
                playerId: player.id,
                name: player.name,
                rooms: roomCount(),
            });
        }),
    );

    // Joins an existing room by code, issuing a fresh seat and reconnect token.
    socket.on(
        CLIENT_EVENT.ROOM_JOIN,
        guard(socket, CLIENT_EVENT.ROOM_JOIN, (payload, ack) => {
            const code = payload.code.toLowerCase();
            const room = getRoom(code);
            if (!room) {
                // A mistyped code and a room that timed out arrive here identically; the count of
                // these against room.collected is what tells them apart.
                log.info('room.join.refused', { roomCode: code, reason: 'not_found' });
                ack(fail(ERROR.ROOM_NOT_FOUND, `no room with code ${payload.code}`));
                return;
            }

            let seat;
            try {
                seat = addPlayer(room, payload.name, socket.id);
            } catch {
                log.info('room.join.refused', {
                    roomCode: code,
                    reason: 'full',
                    players: room.players.size,
                });
                ack(fail(ERROR.ROOM_FULL, 'that room is full'));
                return;
            }

            takeSeat(socket, room, seat.player);
            ack(ok(joinPayload(room, seat.player, seat.token)));
            broadcastRoom(io, room);
            log.info('player.joined', {
                roomCode: room.code,
                playerId: seat.player.id,
                name: seat.player.name,
                players: room.players.size,
            });
        }),
    );

    // Leaves a room deliberately, which gives up the seat immediately rather than on grace expiry.
    socket.on(
        CLIENT_EVENT.ROOM_LEAVE,
        guard(socket, CLIENT_EVENT.ROOM_LEAVE, (_payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;

            releaseSeat({ io, room: seat.room, playerId: seat.player.id, reason: 'left' });
            socket.leave(seat.room.code);
            socket.data = {};
            ack(ok());
        }),
    );

    // Host-only: removes another player's seat outright, and tells them why.
    socket.on(
        CLIENT_EVENT.ROOM_KICK,
        guard(socket, CLIENT_EVENT.ROOM_KICK, (payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;
            if (!isHost(seat.room, seat.player.id)) {
                ack(fail(ERROR.NOT_HOST, 'only the host can remove a player'));
                return;
            }
            if (payload.playerId === seat.player.id) {
                ack(fail(ERROR.NOT_ALLOWED, 'use Leave room to remove yourself'));
                return;
            }

            const target = seat.room.players.get(payload.playerId);
            if (!target) {
                ack(fail(ERROR.NOT_IN_ROOM, 'that player is not in this room'));
                return;
            }

            // Told before dropped: once the seat is gone the socket has nothing to be told about.
            const targetSocket = target.socketId ? io.sockets.sockets.get(target.socketId) : null;
            targetSocket?.emit(SERVER_EVENT.ERROR, {
                code: ERROR.KICKED,
                message: 'The host removed you from the room.',
            });

            releaseSeat({
                io,
                room: seat.room,
                playerId: target.id,
                reason: 'kicked',
                by: seat.player.id,
            });
            targetSocket?.leave(seat.room.code);
            if (targetSocket) targetSocket.data = {};
            ack(ok());
        }),
    );

    // Changes the caller's own colour. A seat only ever speaks for itself, so there is no target
    // player in the payload: you cannot recolour anybody else.
    socket.on(
        CLIENT_EVENT.PLAYER_COLOR,
        guard(socket, CLIENT_EVENT.PLAYER_COLOR, (payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;

            if (!setPlayerColor(seat.room, seat.player.id, payload.colorIndex)) {
                ack(fail(ERROR.NOT_ALLOWED, 'somebody else has that colour'));
                return;
            }

            broadcastPlayers(io, seat.room);
            ack(ok());
        }),
    );

    // Host-only: fetches a puzzle and moves the room into playing.
    socket.on(
        CLIENT_EVENT.GAME_START,
        guard(socket, CLIENT_EVENT.GAME_START, async (payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;
            if (!isHost(seat.room, seat.player.id)) {
                ack(fail(ERROR.NOT_HOST, 'only the host can start a puzzle'));
                return;
            }
            if (seat.room.state === ROOM_STATE.PLAYING) {
                ack(fail(ERROR.WRONG_STATE, 'a puzzle is already in progress'));
                return;
            }

            const spec = {
                type: payload.type,
                difficulty: payload.difficulty,
                size: payload.size,
            };
            const room = seat.room;

            let doc;
            let solution;
            try {
                // served keeps a finite bank from handing back the puzzle the room just solved.
                // A named puzzleId overrides it: having picked that crossword off a list, the host
                // means that one even if the room has played it before (ADR-0009).
                ({ doc, solution } = await getPuzzle({
                    ...spec,
                    puzzleId: payload.puzzleId,
                    exclude: room.served,
                }));
            } catch (error) {
                // A generator refusing a size is a bug; a bank not holding one is a fact about the
                // content, and the host is owed the difference rather than "something went wrong".
                // The message, not the stack: what the bank holds is content, and a stack trace
                // over it reads as a crash that did not happen.
                log.warn('puzzle.unavailable', {
                    roomCode: room.code,
                    type: spec.type,
                    difficulty: spec.difficulty,
                    size: `${spec.size.rows}x${spec.size.cols}`,
                    problem: error.message,
                });
                ack(fail(ERROR.WRONG_STATE, error.message));
                return;
            }
            room.served.add(doc.id);

            room.settings = { ...room.settings, ...spec };
            room.doc = doc;
            room.solution = solution;
            room.board = { seq: 0, cells: {} };
            room.startedAt = Date.now();
            room.assists = 0;
            room.focus.clear();
            room.state = ROOM_STATE.PLAYING;
            touchRoom(room);

            broadcastRoom(io, room);
            io.to(room.code).emit(SERVER_EVENT.GAME_STARTED, toSnapshot(room));
            ack(ok());

            // Get the next puzzle of this shape ready while everyone is busy with this one.
            prewarm(spec);
        }),
    );

    // Applies one cell op: the hot path (architecture.md §3).
    socket.on(
        CLIENT_EVENT.GAME_OP,
        guard(socket, CLIENT_EVENT.GAME_OP, (payload, ack) => {
            if (!buckets.op.tryConsume()) {
                ack(fail(ERROR.RATE_LIMITED, 'slow down'));
                return;
            }

            const seat = seatOrFail(socket, ack);
            if (!seat) return;

            const room = seat.room;
            if (room.state !== ROOM_STATE.PLAYING) {
                ack(fail(ERROR.WRONG_STATE, 'no puzzle is in progress'));
                return;
            }

            const module = getPuzzleModule(room.doc.type);
            if (!module.validateOp(room.doc, payload.op)) {
                ack(fail(ERROR.INVALID_OP, 'that op is not legal on this puzzle'));
                return;
            }

            const seq = room.board.seq + 1;
            room.board = applyOp(room.board, payload.op, { seq, by: seat.player.id });
            touchRoom(room);

            const stamped = { ...payload.op, seq, by: seat.player.id, at: Date.now() };
            io.to(room.code).emit(SERVER_EVENT.GAME_OP, stamped);
            ack(ok({ seq }));

            if (module.isComplete(room.doc, room.board, room.solution)) {
                finishPuzzle(io, room);
            }
        }),
    );

    // Broadcasts where a player is looking. Presence only; it locks nothing.
    socket.on(
        CLIENT_EVENT.GAME_FOCUS,
        guard(socket, CLIENT_EVENT.GAME_FOCUS, (payload, ack) => {
            if (!buckets.focus.tryConsume()) {
                ack(fail(ERROR.RATE_LIMITED, 'too many focus updates'));
                return;
            }

            const seat = seatOrFail(socket, ack);
            if (!seat) return;

            const cell = payload.cell ?? null;
            if (cell == null) {
                seat.room.focus.delete(seat.player.id);
            } else {
                seat.room.focus.set(seat.player.id, cell);
            }

            socket.to(seat.room.code).emit(SERVER_EVENT.GAME_FOCUS, {
                playerId: seat.player.id,
                cell,
            });
            ack(ok());
        }),
    );

    // Serves a full snapshot after a client detects a seq gap.
    socket.on(
        CLIENT_EVENT.SYNC_REQUEST,
        guard(socket, CLIENT_EVENT.SYNC_REQUEST, (_payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;

            socket.emit(SERVER_EVENT.GAME_SNAPSHOT, toSnapshot(seat.room));
            ack(ok());
        }),
    );

    // Grades every filled cell against the solution. Free: it never touches the streak.
    socket.on(
        CLIENT_EVENT.GAME_CHECK,
        guard(socket, CLIENT_EVENT.GAME_CHECK, (_payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;

            const room = seat.room;
            if (room.state !== ROOM_STATE.PLAYING) {
                ack(fail(ERROR.WRONG_STATE, 'no puzzle is in progress'));
                return;
            }
            if (!room.settings.checkingAllowed) {
                ack(fail(ERROR.NOT_ALLOWED, 'checking is switched off in this room'));
                return;
            }
            if (!buckets.assist.tryConsume()) {
                ack(fail(ERROR.RATE_LIMITED, 'give it a moment before checking again'));
                return;
            }

            const result = checkPuzzle(room, getPuzzleModule(room.doc.type));
            result.by = seat.player.id;

            // Broadcast, not private: assists are counted per room, so a check is something the
            // room did rather than something one player did quietly.
            io.to(room.code).emit(SERVER_EVENT.GAME_CHECK_RESULT, result);
            ack(ok());
        }),
    );

    // Host-only: fills the grid from the solution, which ends the puzzle and resets the streak.
    socket.on(
        CLIENT_EVENT.GAME_REVEAL,
        guard(socket, CLIENT_EVENT.GAME_REVEAL, (_payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;
            if (!isHost(seat.room, seat.player.id)) {
                ack(fail(ERROR.NOT_HOST, 'only the host can reveal the puzzle'));
                return;
            }

            const room = seat.room;
            if (room.state !== ROOM_STATE.PLAYING) {
                ack(fail(ERROR.WRONG_STATE, 'no puzzle is in progress'));
                return;
            }
            if (!room.settings.revealAllowed) {
                ack(fail(ERROR.NOT_ALLOWED, 'revealing is switched off in this room'));
                return;
            }
            if (!buckets.assist.tryConsume()) {
                ack(fail(ERROR.RATE_LIMITED, 'give it a moment'));
                return;
            }

            io.to(room.code).emit(SERVER_EVENT.GAME_SOLVED, revealPuzzle(room));
            broadcastRoom(io, room);
            ack(ok());
        }),
    );

    // Host-only: abandons the current puzzle and returns the whole room to Puzzle Select.
    socket.on(
        CLIENT_EVENT.ROOM_BACK_TO_SELECT,
        guard(socket, CLIENT_EVENT.ROOM_BACK_TO_SELECT, (_payload, ack) => {
            const seat = seatOrFail(socket, ack);
            if (!seat) return;
            if (!isHost(seat.room, seat.player.id)) {
                ack(fail(ERROR.NOT_HOST, 'only the host can return the room to puzzle select'));
                return;
            }

            const room = seat.room;
            if (room.state === ROOM_STATE.SELECT) {
                ack(fail(ERROR.WRONG_STATE, 'the room is already at puzzle select'));
                return;
            }

            abandonPuzzle(room);
            broadcastRoom(io, room);
            io.to(room.code).emit(SERVER_EVENT.GAME_SNAPSHOT, toSnapshot(room));
            ack(ok());
        }),
    );

    // Holds the seat for the grace period rather than dropping it immediately.
    socket.on('disconnect', (reason) => {
        const seat = currentSeat(socket);
        if (!seat || seat.player.socketId !== socket.id) return;

        markDisconnected(seat.room, seat.player.id, config.disconnectGraceMs, (room, playerId) =>
            releaseSeat({ io, room, playerId, reason: 'grace_expired' }),
        );
        broadcastPlayers(io, seat.room);
        // Socket.IO's reason is the difference between a closed tab, a lost network, and a client
        // that stopped answering pings, which is otherwise unknowable from this side.
        log.info('player.disconnected', {
            roomCode: seat.room.code,
            playerId: seat.player.id,
            name: seat.player.name,
            reason,
            graceMs: config.disconnectGraceMs,
        });
    });
}

/**
 * Records a solved puzzle and tells the room. Completion is decided here, from server state, never
 * claimed by a client.
 */
function finishPuzzle(io, room) {
    io.to(room.code).emit(SERVER_EVENT.GAME_SOLVED, solvePuzzle(room));
    broadcastRoom(io, room);
}

/**
 * Tells everyone still in a room that it has ended, then cuts their sockets loose. The garbage
 * collector calls this before deleting a room, since a room deleted under a player leaves their
 * client drawing a grid nothing receives (ADR-0025).
 *
 * @param {import('socket.io').Server} io - The Socket.IO server.
 * @param {import('../rooms/store.js').Room} room - The room about to be deleted.
 * @returns {void}
 */
export function closeRoom(io, room) {
    io.to(room.code).emit(SERVER_EVENT.ERROR, {
        code: ERROR.ROOM_CLOSED,
        message: 'This room reached its time limit and was closed.',
    });
    io.in(room.code).disconnectSockets(true);
}

/**
 * Wires connection-time identity: protocol check, then reconnect-token restore.
 *
 * @param {import('socket.io').Server} io - The Socket.IO server.
 * @returns {void}
 */
export function registerConnectionHandler(io) {
    io.on('connection', (socket) => {
        socket.data = {};
        const handshake = readHandshake(socket);

        if (!isProtocolCompatible(handshake.protocolVersion)) {
            // After a deploy this is the only thing that says clients are still on the old build.
            log.warn('protocol.mismatch', {
                socketId: socket.id,
                client: handshake.protocolVersion,
                server: PROTOCOL_VERSION,
            });
            socket.emit(SERVER_EVENT.ERROR, {
                code: ERROR.PROTOCOL_MISMATCH,
                message: 'This page appears to be out of date. Please refresh.',
            });
            socket.disconnect(true);
            return;
        }

        const restored = restoreSeat(socket);
        if (restored) {
            // Two tabs on one room share a token; the newer socket wins and the older is told why
            // rather than silently misbehaving (ADR-0005).
            if (restored.previousSocketId) {
                const previous = io.sockets.sockets.get(restored.previousSocketId);
                previous?.emit(SERVER_EVENT.ERROR, {
                    code: ERROR.SEAT_TAKEN,
                    message: 'This seat was claimed by another tab.',
                });
                previous?.disconnect(true);
            }

            takeSeat(socket, restored.room, restored.player);
            // The client already holds its token; what it needs back is which seat it is.
            socket.emit(
                SERVER_EVENT.ROOM_JOINED,
                joinPayload(restored.room, restored.player, null),
            );
            broadcastPlayers(io, restored.room);
            log.info('player.reconnected', {
                roomCode: restored.room.code,
                playerId: restored.player.id,
                name: restored.player.name,
                displaced: Boolean(restored.previousSocketId),
            });
        } else if (handshake.token) {
            // A token that restores nothing means one of two things, and they are not the same
            // news: the room is gone, or the room is alive and the seat in it is not theirs any
            // more. Told apart here, because "that room has ended" said over a room full of people
            // sends the player away from one they could walk straight back into.
            const roomAlive = Boolean(handshake.code && getRoom(handshake.code));
            log.info('seat.stale', {
                roomCode: handshake.code,
                reason: roomAlive ? 'seat_gone' : 'room_gone',
            });
            socket.emit(
                SERVER_EVENT.ERROR,
                roomAlive
                    ? {
                          code: ERROR.NOT_IN_ROOM,
                          message: 'Your seat timed out and was removed.',
                      }
                    : {
                          code: ERROR.ROOM_NOT_FOUND,
                          message:
                              'This room does not exist. It timed out or the server restarted.',
                      },
            );
        }

        registerHandlers(io, socket);

        log.debug('socket.connected', { socketId: socket.id, restored: Boolean(restored) });
    });
}
