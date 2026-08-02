/**
 * Single source of truth for room, board, and presence state on the client.
 *
 * Owns the socket; components never touch one directly. Holds optimistic `pendingOps` and exposes
 * `serverState + pendingOps` as `view`, so there is no rollback machinery — re-deriving is cheap
 * (ADR-0001). Does not own routing or rendering; see `<pt-app>` for those.
 */

import { io } from 'socket.io-client';

import { applyOp, applyOps, emptyBoard } from '../../shared/board-reducer.js';
import { FOCUS_THROTTLE_MS } from '../../shared/constants.js';
import {
    CLIENT_EVENT,
    ERROR,
    OP_TYPE,
    PROTOCOL_VERSION,
    ROOM_STATE,
    SERVER_EVENT,
} from '../../shared/protocol.js';

/** `localStorage` key holding the reconnect token for one room. */
function tokenKey(code) {
    return `pt:token:${code}`;
}

/** Reads a stored reconnect token, tolerating a `localStorage` that refuses to answer. */
function readToken(code) {
    try {
        return window.localStorage.getItem(tokenKey(code));
    } catch {
        // Private-browsing modes can throw here; a missing token just means "join fresh".
        return null;
    }
}

/** Stores or clears a reconnect token for a room. */
function writeToken(code, token) {
    try {
        if (token) window.localStorage.setItem(tokenKey(code), token);
        else window.localStorage.removeItem(tokenKey(code));
    } catch {
        // Losing the token only costs the seat on refresh, which is not worth failing a join over.
    }
}

/** The state a store holds before anyone has joined anything. */
function initialState() {
    return {
        connection: 'idle',
        error: null,
        code: null,
        playerId: null,
        room: null,
        doc: null,
        board: emptyBoard(),
        view: emptyBoard(),
        pendingOps: [],
        focus: {},
        selection: null,
        startedAt: null,
        clockOffsetMs: 0,
        solved: null,
    };
}

export class RoomStore {
    #socket = null;
    #listeners = new Set();
    #state = initialState();
    #nextOpId = 1;
    #lastFocusSentAt = 0;
    #focusTimer = null;

    /**
     * The current state. Treated as immutable by callers — every mutation goes through a method.
     *
     * @returns {object} The current state object.
     */
    get state() {
        return this.#state;
    }

    /**
     * Whether the local player is this room's host. The server authorizes host actions regardless;
     * this only decides whether host controls render (ADR-0005).
     *
     * @returns {boolean} True when the local player holds the host seat.
     */
    get isHost() {
        return Boolean(this.#state.room && this.#state.room.hostId === this.#state.playerId);
    }

    /**
     * Subscribes to state changes.
     *
     * @param {(state: object) => void} listener - Called after every state change.
     * @returns {() => void} Unsubscribe function.
     */
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    /**
     * Creates a room and takes the host seat.
     *
     * @param {string} name - Display name.
     * @returns {Promise<string>} The new room's code.
     * @throws {Error} If the server rejects the request.
     */
    async createRoom(name) {
        this.#connect({ code: null, token: null });
        const data = await this.#request(CLIENT_EVENT.ROOM_CREATE, { name });
        this.#acceptSeat(data);
        return data.code;
    }

    /**
     * Joins an existing room by code.
     *
     * @param {string} name - Display name.
     * @param {string} code - The 4-character room code.
     * @returns {Promise<string>} The room's code.
     * @throws {Error} If the room is missing or full.
     */
    async joinRoom(name, code) {
        const normalized = code.trim().toLowerCase();
        this.#connect({ code: null, token: null });
        const data = await this.#request(CLIENT_EVENT.ROOM_JOIN, { name, code: normalized });
        this.#acceptSeat(data);
        return data.code;
    }

    /**
     * Reclaims a seat after a reload, using the token stored for that room.
     *
     * @param {string} code - The room code from the URL.
     * @returns {boolean} True when a token existed and a restore was attempted.
     */
    resume(code) {
        const token = readToken(code);
        if (!token) return false;

        this.#set({ code, connection: 'connecting' });
        this.#connect({ code, token });
        return true;
    }

    /**
     * Asks the server to start a puzzle. Host-only; a non-host call is rejected server-side.
     *
     * @param {object} spec - Puzzle specification: `type`, `difficulty`, and `size`.
     * @returns {Promise<void>} Resolves once the server has accepted.
     * @throws {Error} If the caller is not the host or a puzzle is already running.
     */
    async startPuzzle(spec) {
        await this.#request(CLIENT_EVENT.GAME_START, spec);
    }

    /**
     * Writes a value into a cell, applying it locally before the server has seen it.
     *
     * @param {number} cell - Cell index.
     * @param {string} value - The value to write.
     * @returns {void}
     */
    setValue(cell, value) {
        this.#sendOp({ opId: this.#makeOpId(), t: OP_TYPE.SET, cell, value });
    }

    /**
     * Clears a cell.
     *
     * @param {number} cell - Cell index.
     * @returns {void}
     */
    clearCell(cell) {
        this.#sendOp({ opId: this.#makeOpId(), t: OP_TYPE.CLEAR, cell });
    }

    /**
     * Moves the local selection and broadcasts it as presence, throttled to the rate the server
     * accepts (design-spec.md §6).
     *
     * @param {number|null} cell - The focused cell, or null when focus leaves the grid.
     * @returns {void}
     */
    setSelection(cell) {
        if (this.#state.selection === cell) return;
        this.#set({ selection: cell });

        const elapsed = Date.now() - this.#lastFocusSentAt;
        if (elapsed >= FOCUS_THROTTLE_MS) {
            this.#sendFocus(cell);
            return;
        }

        clearTimeout(this.#focusTimer);
        this.#focusTimer = setTimeout(
            () => this.#sendFocus(this.#state.selection),
            FOCUS_THROTTLE_MS - elapsed,
        );
    }

    /**
     * Leaves the room and returns the store to its initial state.
     *
     * @returns {void}
     */
    leave() {
        const code = this.#state.code;
        if (this.#socket?.connected) this.#socket.emit(CLIENT_EVENT.ROOM_LEAVE, {});
        if (code) writeToken(code, null);
        this.#socket?.disconnect();
        this.#socket = null;
        this.#state = initialState();
        this.#notify();
    }

    /** Opens a socket, replacing any existing one, with the handshake identity this room needs. */
    #connect({ code, token }) {
        this.#socket?.disconnect();
        this.#set({ connection: 'connecting', error: null });

        const socket = io({
            auth: { token, code, protocolVersion: PROTOCOL_VERSION },
            transports: ['websocket', 'polling'],
        });
        this.#socket = socket;

        socket.on('connect', () => this.#set({ connection: 'connected' }));
        socket.on('disconnect', () => this.#set({ connection: 'connecting' }));
        socket.on(SERVER_EVENT.ROOM_JOINED, (data) => this.#acceptSeat(data));
        socket.on(SERVER_EVENT.ROOM_STATE, (room) => this.#set({ room }));
        socket.on(SERVER_EVENT.ROOM_PLAYERS, (players) => {
            if (this.#state.room) this.#set({ room: { ...this.#state.room, players } });
        });
        socket.on(SERVER_EVENT.GAME_STARTED, (snapshot) => this.#acceptSnapshot(snapshot, true));
        socket.on(SERVER_EVENT.GAME_SNAPSHOT, (snapshot) => this.#acceptSnapshot(snapshot, false));
        socket.on(SERVER_EVENT.GAME_OP, (stamped) => this.#acceptOp(stamped));
        socket.on(SERVER_EVENT.GAME_FOCUS, ({ playerId, cell }) =>
            this.#acceptFocus(playerId, cell),
        );
        socket.on(SERVER_EVENT.GAME_SOLVED, (result) => this.#acceptSolved(result));
        socket.on(SERVER_EVENT.ERROR, (error) => this.#acceptError(error));
    }

    /** Emits an event and resolves with its ack data, rejecting on a structured error. */
    #request(event, payload) {
        return new Promise((resolve, reject) => {
            if (!this.#socket) {
                reject(new Error('not connected'));
                return;
            }
            this.#socket.emit(event, payload, (ack) => {
                if (ack?.ok) resolve(ack.data);
                else reject(new Error(ack?.error?.message ?? 'the server rejected that request'));
            });
        });
    }

    /** Records the seat the server gave us, storing the reconnect token if this is a fresh join. */
    #acceptSeat(data) {
        if (data.playerToken) writeToken(data.code, data.playerToken);
        this.#set({
            connection: 'connected',
            error: null,
            code: data.code,
            playerId: data.playerId,
            room: data.room,
        });
        this.#acceptSnapshot(data.snapshot, false);
    }

    /** Replaces board state wholesale — the gap-recovery path, and how every puzzle starts. */
    #acceptSnapshot(snapshot, isNewPuzzle) {
        const board = snapshot.board ?? emptyBoard();
        this.#set({
            doc: snapshot.doc,
            board,
            view: board,
            pendingOps: [],
            focus: snapshot.focus ?? {},
            startedAt: snapshot.startedAt,
            clockOffsetMs: snapshot.serverNow - Date.now(),
            solved: isNewPuzzle ? null : this.#state.solved,
            selection: isNewPuzzle ? null : this.#state.selection,
        });
    }

    /**
     * Applies a server-stamped op. A `seq` gap means ops were missed, which is answered with a
     * full snapshot rather than a replay (ADR-0001).
     */
    #acceptOp(stamped) {
        const expected = this.#state.board.seq + 1;
        if (stamped.seq < expected) return;
        if (stamped.seq > expected) {
            this.#requestSync();
            return;
        }

        const board = applyOp(this.#state.board, stamped, { seq: stamped.seq, by: stamped.by });
        const pendingOps = this.#state.pendingOps.filter((op) => op.opId !== stamped.opId);
        this.#setBoard(board, pendingOps);
    }

    /** Records another player's focus for the presence layer. */
    #acceptFocus(playerId, cell) {
        const focus = { ...this.#state.focus };
        if (cell == null) delete focus[playerId];
        else focus[playerId] = cell;
        this.#set({ focus });
    }

    /** Records a server-verified solve. The time shown is the server's, never a client's. */
    #acceptSolved(result) {
        this.#setBoard(result.board, []);
        this.#set({ solved: result });
    }

    /** Surfaces a server error, dropping a dead room's token so the client can start over. */
    #acceptError(error) {
        if (error.code === ERROR.ROOM_NOT_FOUND && this.#state.code) {
            writeToken(this.#state.code, null);
        }
        this.#set({ error, connection: 'error' });
    }

    /** Applies an op locally, queues it as pending, and sends it. */
    #sendOp(op) {
        if (this.#state.room?.state !== ROOM_STATE.PLAYING) return;

        this.#setBoard(this.#state.board, [...this.#state.pendingOps, op]);
        this.#socket?.emit(CLIENT_EVENT.GAME_OP, { op }, (ack) => {
            if (ack?.ok) return;
            // A rejected op never happened: drop it and let the server's state stand.
            this.#setBoard(
                this.#state.board,
                this.#state.pendingOps.filter((pending) => pending.opId !== op.opId),
            );
        });
    }

    /** Sends the current focus cell, recording when so the throttle can pace the next one. */
    #sendFocus(cell) {
        this.#lastFocusSentAt = Date.now();
        this.#socket?.emit(CLIENT_EVENT.GAME_FOCUS, { cell: cell ?? null }, () => {});
    }

    /** Asks for a full snapshot after detecting a gap. */
    #requestSync() {
        this.#socket?.emit(CLIENT_EVENT.SYNC_REQUEST, {}, () => {});
    }

    /**
     * Stores a new board and pending list, re-deriving the rendered view.
     *
     * Pending ops are stamped above the server's `seq` so they win locally until their echo lands,
     * which is what makes typing feel instant without a rollback path.
     */
    #setBoard(board, pendingOps) {
        const stamped = pendingOps.map((op, index) => ({
            ...op,
            seq: board.seq + index + 1,
            by: this.#state.playerId,
        }));
        this.#set({ board, pendingOps, view: applyOps(board, stamped) });
    }

    /** Client-unique op id: the local player plus a counter is enough to match an echo. */
    #makeOpId() {
        const id = this.#nextOpId;
        this.#nextOpId += 1;
        return `${this.#state.playerId ?? 'anon'}-${id}`;
    }

    /** Merges a partial state and notifies subscribers. */
    #set(partial) {
        this.#state = { ...this.#state, ...partial };
        this.#notify();
    }

    /** Calls every subscriber with the current state. */
    #notify() {
        for (const listener of this.#listeners) listener(this.#state);
    }
}

/** The app's single store instance. One store, one socket (architecture.md §6). */
export const roomStore = new RoomStore();
