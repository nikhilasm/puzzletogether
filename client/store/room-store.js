/**
 * Single source of truth for room, board, presence, and input state on the client.
 *
 * Owns the socket; components never touch one directly. Holds optimistic pendingOps and exposes
 * serverState + pendingOps as view, so there is no rollback machinery; re-deriving is cheap
 * (ADR-0001). Every input source lands on the same few methods here, which is where the Notes/Solve
 * branch happens once rather than in each component. Does not own routing or rendering; see
 * <pt-app> for those.
 */

import { io } from 'socket.io-client';

import { applyOp, applyOps, emptyBoard } from '../../shared/board-reducer.js';
import {
    FOCUS_THROTTLE_MS,
    MAX_CELL_VALUE_LENGTH,
    NOTICE_TIMEOUT_MS,
} from '../../shared/constants.js';
import {
    CHECK_STATE,
    CLIENT_EVENT,
    ERROR,
    INPUT_MODE,
    PROTOCOL_VERSION,
    ROOM_STATE,
    SERVER_EVENT,
} from '../../shared/protocol.js';

import { clearOp, fillOp, opForDigit, opResult, restoreOp, setOp } from './ops.js';
import { UndoStack, sameCell, snapshotCell } from './undo-stack.js';

/** localStorage key holding the reconnect token for one room. */
function tokenKey(code) {
    return `pt:token:${code}`;
}

/** Reads a stored reconnect token, tolerating a localStorage that refuses to answer. */
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
        notice: null,
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
        inputMode: INPUT_MODE.SOLVE,
        // Which mark a nonogram tap lays down. Filling is what a solver does most, so it is the one
        // you start on; the other two are what you switch to.
        brush: 'fill',
        // Whether a crossword keystroke appends to the square instead of replacing it (ADR-0007).
        // Off by default because a rebus square is the exception in any grid that has one at all.
        rebus: false,
        // What this build can serve, from the join ack. Null until seated: Puzzle Select is only
        // ever reached from inside a room, so it never renders without one.
        catalog: null,
        checkResults: {},
        assists: 0,
        canUndo: false,
    };
}

export class RoomStore {
    #socket = null;
    #listeners = new Set();
    #state = initialState();
    #nextOpId = 1;
    #lastFocusSentAt = 0;
    #focusTimer = null;
    #noticeTimer = null;
    #undo = new UndoStack();

    /**
     * The current state. Treated as immutable by callers; every mutation goes through a method.
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
     * Asks the server to start a puzzle, from Puzzle Select or from the congrats modal. Host-only;
     * a non-host call is rejected server-side.
     *
     * @param {object} spec - Puzzle specification: type, difficulty, and size.
     * @returns {Promise<void>} Resolves once the server has accepted.
     * @throws {Error} If the caller is not the host or a puzzle is already running.
     */
    async startPuzzle(spec) {
        await this.#request(CLIENT_EVENT.GAME_START, spec);
    }

    /**
     * Handles a digit from any input source (keyboard, keypad, or touch), branching on the
     * Notes/Solve mode.
     *
     * @param {number} cell - Cell index.
     * @param {string} value - The digit pressed.
     * @returns {void}
     */
    inputDigit(cell, value) {
        const current = snapshotCell(this.#state.view.cells[cell]);
        const op = opForDigit({
            opId: this.#makeOpId(),
            cell,
            value,
            isNotes: this.#state.inputMode === INPUT_MODE.NOTES,
            current,
        });
        if (op) this.#sendOp(op, current);
    }

    /**
     * Writes a value into a cell regardless of input mode, bypassing the Notes branch.
     *
     * @param {number} cell - Cell index.
     * @param {string} value - The value to write.
     * @returns {void}
     */
    setValue(cell, value) {
        const current = snapshotCell(this.#state.view.cells[cell]);
        this.#sendOp(setOp(this.#makeOpId(), cell, value), current);
    }

    /**
     * Clears a cell of its value and its marks.
     *
     * @param {number} cell - Cell index.
     * @returns {void}
     */
    clearCell(cell) {
        const current = snapshotCell(this.#state.view.cells[cell]);
        this.#sendOp(clearOp(this.#makeOpId(), cell), current);
    }

    /**
     * Writes one value across a run of cells: what a nonogram drag produces.
     *
     * The undo entries are written here rather than left to #sendOp, because they are per cell
     * while the op is not: they carry a shared group id so the whole stroke walks back together.
     *
     * @param {number[]} cells - Cell indices the stroke covered.
     * @param {string|null} value - The value to write, or null to empty them.
     * @returns {void}
     */
    paintCells(cells, value) {
        if (cells.length === 0) return;

        const op = fillOp(this.#makeOpId(), cells, value);
        for (const cell of cells) {
            const before = snapshotCell(this.#state.view.cells[cell]);
            this.#undo.record({ cell, before, after: opResult(op, before), group: op.opId });
        }

        this.#sendOp(op, null, { record: false });
    }

    /**
     * Switches between entering values and entering pencil marks.
     *
     * @param {string} mode - One of INPUT_MODE.
     * @returns {void}
     */
    setInputMode(mode) {
        if (mode !== INPUT_MODE.SOLVE && mode !== INPUT_MODE.NOTES) return;
        this.#set({ inputMode: mode });
    }

    /**
     * Switches which mark a nonogram tap or drag lays down.
     *
     * Client-side only, like the Notes mode: the op says what it writes, so the server never needs to
     * know which brush produced it. It is also **per player**: two people can be painting and
     * crossing the same picture at once without fighting over one setting.
     *
     * @param {string} brush - One of 'fill', 'cross', or 'erase'.
     * @returns {void}
     */
    setBrush(brush) {
        if (!['fill', 'cross', 'erase'].includes(brush)) return;
        this.#set({ brush });
    }

    /**
     * Switches a crossword between one letter per square and a whole word in one.
     *
     * The same shape of setting as Notes and the brush: client-side, per player, and it changes
     * what a keypress *means* rather than changing the grid. Every puzzle type has exactly one of
     * these above its keys (design-spec.md §4).
     *
     * @param {boolean} rebus - True to append letters rather than replace them.
     * @returns {void}
     */
    setRebus(rebus) {
        this.#set({ rebus: rebus === true });
    }

    /**
     * Writes a letter into a crossword square, appending when the square is being built into a word.
     *
     * Every keystroke sends the **whole** value the square now holds, never an "append", which is
     * what keeps a rebus off the op vocabulary entirely (ADR-0007). Per-cell last-writer-wins, undo
     * pre-images, and gap-recovery snapshots all keep working on a value that is simply longer.
     *
     * Appending stops at the cell-value bound rather than silently dropping the keystroke past it,
     * because a limit the player cannot see is one they will keep pressing against.
     *
     * @param {number} cell - Cell index.
     * @param {string} letter - The letter pressed, already filtered by the board.
     * @param {boolean} [append] - True to extend the square's value instead of replacing it.
     * @returns {void}
     */
    inputLetter(cell, letter, append = false) {
        const current = snapshotCell(this.#state.view.cells[cell]);
        const existing = append ? (current?.value ?? '') : '';

        if (existing.length >= MAX_CELL_VALUE_LENGTH) {
            this.notify(`a square holds at most ${MAX_CELL_VALUE_LENGTH} letters`);
            return;
        }

        this.#sendOp(setOp(this.#makeOpId(), cell, existing + letter), current);
    }

    /**
     * Removes the last letter of a square being built into a rebus, or clears it outright.
     *
     * While assembling a word, taking back the last letter is the correction the player means;
     * clearing the lot is not. One letter left is the same as an empty square, so that clears.
     *
     * @param {number} cell - Cell index.
     * @returns {void}
     */
    backspaceLetter(cell) {
        const current = snapshotCell(this.#state.view.cells[cell]);
        const value = current?.value ?? '';
        if (value.length <= 1) {
            this.clearCell(cell);
            return;
        }
        this.#sendOp(setOp(this.#makeOpId(), cell, value.slice(0, -1)), current);
    }

    /**
     * Undoes this player's most recent edit by making a new one that restores the earlier value.
     *
     * Forward-only: if somebody else has written to a cell since, that cell is left alone, because
     * rewinding over their work would be the greater surprise (design-spec.md §6).
     *
     * A drag walks back as one action, and one cell of it having moved on does not strand the other
     * nineteen: the cells still holding what this player left there are restored, and the notice
     * says the rest were not.
     *
     * @returns {void}
     */
    undo() {
        const entries = this.#undo.popGroup();
        this.#set({ canUndo: this.#undo.size > 0 });
        if (entries.length === 0) return;

        const restorable = entries.filter((entry) =>
            sameCell(snapshotCell(this.#state.view.cells[entry.cell]), entry.after),
        );

        if (restorable.length === 0) {
            this.#notice(
                entries.length === 1
                    ? 'undo skipped: that cell has changed since'
                    : 'undo skipped: those squares have changed since',
            );
            return;
        }

        this.#restore(restorable);
        if (restorable.length < entries.length) {
            this.#notice('some squares had changed since, so they were left as they are');
        }
    }

    /**
     * Puts a set of cells back the way their undo entries remember them.
     *
     * Cells that were left in the same state travel together as one fill, so undoing a
     * twenty-cell drag is one write rather than twenty, which matters because twenty ops in a burst
     * is most of a player's rate-limit allowance (OP_RATE_LIMIT) spent walking something back.
     */
    #restore(entries) {
        const byValue = new Map();
        for (const entry of entries) {
            // Only value-only states can share an op; anything with marks is restored on its own.
            const key = entry.before.marks.length > 0 ? Symbol('marks') : entry.before.value;
            if (!byValue.has(key)) byValue.set(key, []);
            byValue.get(key).push(entry);
        }

        for (const group of byValue.values()) {
            const current = snapshotCell(this.#state.view.cells[group[0].cell]);
            const op =
                group.length === 1
                    ? restoreOp(this.#makeOpId(), group[0].cell, group[0].before)
                    : fillOp(
                          this.#makeOpId(),
                          group.map((entry) => entry.cell),
                          group[0].before.value,
                      );
            this.#sendOp(op, current, { record: false });
        }
    }

    /**
     * Asks the server to grade every filled cell. Free, since it never touches the streak, but it
     * does count against the room's assists, and the result goes to everyone.
     *
     * @returns {Promise<void>} Resolves once the server has accepted.
     */
    async check() {
        await this.#requestOrNotice(CLIENT_EVENT.GAME_CHECK, {});
    }

    /**
     * Asks the server to fill in the whole grid. Host-only, destructive, and resets the streak, so
     * always behind a confirm dialog.
     *
     * @returns {Promise<void>} Resolves once the server has accepted.
     */
    async reveal() {
        await this.#requestOrNotice(CLIENT_EVENT.GAME_REVEAL, {});
    }

    /**
     * Returns the whole room to Puzzle Select, abandoning the current puzzle. Host-only.
     *
     * @returns {Promise<void>} Resolves once the server has accepted.
     */
    async backToSelect() {
        await this.#requestOrNotice(CLIENT_EVENT.ROOM_BACK_TO_SELECT, {});
    }

    /**
     * Removes another player's seat. Host-only; a non-host call is rejected server-side.
     *
     * @param {string} playerId - The player to remove. Never the caller's own id.
     * @returns {Promise<void>} Resolves once the server has accepted.
     * @throws {Error} If the caller is not the host or that player has already gone.
     */
    async kickPlayer(playerId) {
        await this.#request(CLIENT_EVENT.ROOM_KICK, { playerId });
    }

    /**
     * Claims a palette colour for the local player.
     *
     * The roster arrives back from the server rather than being set here: the colour has to be
     * unique across the room, and only the server knows what every other seat holds right now.
     *
     * @param {number} colorIndex - Index into the player palette.
     * @returns {Promise<void>} Resolves once the server has accepted.
     * @throws {Error} If somebody else holds that colour.
     */
    async chooseColor(colorIndex) {
        await this.#request(CLIENT_EVENT.PLAYER_COLOR, { colorIndex });
    }

    /**
     * Shows a short-lived line of feedback, for the cases a component notices rather than the
     * socket: "pick a square first" and the like.
     *
     * @param {string} text - What to say. Replaces whatever notice is on screen.
     * @returns {void}
     */
    notify(text) {
        this.#notice(text);
    }

    /**
     * Dismisses the congrats modal, leaving the completed grid on screen.
     *
     * @returns {void}
     */
    dismissSolved() {
        if (this.#state.solved) this.#set({ solved: { ...this.#state.solved, dismissed: true } });
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
        this.#undo.clear();
        clearTimeout(this.#noticeTimer);
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
        socket.on(SERVER_EVENT.ROOM_STATE, (room) => this.#acceptRoom(room));
        socket.on(SERVER_EVENT.ROOM_PLAYERS, (players) => {
            if (this.#state.room) this.#set({ room: { ...this.#state.room, players } });
        });
        socket.on(SERVER_EVENT.GAME_STARTED, (snapshot) => this.#acceptSnapshot(snapshot, true));
        socket.on(SERVER_EVENT.GAME_SNAPSHOT, (snapshot) => this.#acceptSnapshot(snapshot, false));
        socket.on(SERVER_EVENT.GAME_OP, (stamped) => this.#acceptOp(stamped));
        socket.on(SERVER_EVENT.GAME_FOCUS, ({ playerId, cell }) =>
            this.#acceptFocus(playerId, cell),
        );
        socket.on(SERVER_EVENT.GAME_CHECK_RESULT, (result) => this.#acceptCheckResult(result));
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

    /**
     * Emits an event whose failure is worth a line on screen rather than a thrown error: the
     * assist controls, where "give it a moment" is the whole story.
     */
    async #requestOrNotice(event, payload) {
        try {
            await this.#request(event, payload);
        } catch (error) {
            this.#notice(error.message);
        }
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
            // Fixed for the life of the server process, so it arrives once with the seat rather
            // than on every room update that cannot have changed it.
            catalog: data.catalog ?? null,
        });
        this.#acceptSnapshot(data.snapshot, false);
    }

    /**
     * Records a new room view. Returning to select also drops what belonged to the finished
     * puzzle, so a dismissed modal or stale check marks cannot survive into the next one.
     */
    #acceptRoom(room) {
        const leftPuzzle = room.state === ROOM_STATE.SELECT;
        this.#set({
            room,
            solved: leftPuzzle ? null : this.#state.solved,
            checkResults: leftPuzzle ? {} : this.#state.checkResults,
        });
    }

    /** Replaces board state wholesale: the gap-recovery path, and how every puzzle starts. */
    #acceptSnapshot(snapshot, isNewPuzzle) {
        const board = snapshot.board ?? emptyBoard();
        if (isNewPuzzle) this.#undo.clear();

        this.#set({
            doc: snapshot.doc,
            board,
            view: board,
            pendingOps: [],
            focus: snapshot.focus ?? {},
            startedAt: snapshot.startedAt,
            clockOffsetMs: snapshot.serverNow - Date.now(),
            assists: snapshot.assists ?? 0,
            solved: isNewPuzzle ? null : this.#state.solved,
            selection: isNewPuzzle ? null : this.#state.selection,
            checkResults: isNewPuzzle ? {} : this.#state.checkResults,
            canUndo: isNewPuzzle ? false : this.#state.canUndo,
        });
    }

    /**
     * Applies a server-stamped op. A seq gap means ops were missed, which is answered with a
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
        this.#retireCheckResults(stamped);
        this.#setBoard(board, pendingOps);
    }

    /** Records another player's focus for the presence layer. */
    #acceptFocus(playerId, cell) {
        const focus = { ...this.#state.focus };
        if (cell == null) delete focus[playerId];
        else focus[playerId] = cell;
        this.#set({ focus });
    }

    /** Records a check the room ran. Replaces the previous marks rather than merging with them. */
    #acceptCheckResult(result) {
        this.#set({ checkResults: result.cells ?? {}, assists: result.assists });

        const graded = Object.values(result.cells ?? {});
        const wrong = graded.filter((state) => state === CHECK_STATE.WRONG).length;
        this.#notice(wrong === 0 ? 'checked: nothing wrong so far' : `checked: ${wrong} wrong`);
    }

    /** Records a server-verified solve, or a reveal. The time shown is the server's, never ours. */
    #acceptSolved(result) {
        this.#undo.clear();
        this.#setBoard(result.board, []);
        this.#set({
            solved: { ...result, dismissed: false },
            assists: result.assists,
            checkResults: {},
            canUndo: false,
        });
    }

    /** Surfaces a server error, dropping a dead room's token so the client can start over. */
    #acceptError(error) {
        if (error.code === ERROR.ROOM_NOT_FOUND && this.#state.code) {
            writeToken(this.#state.code, null);
        }

        // Being removed is not a failed request but the end of a seat, so it clears the room the
        // same way leaving does, keeping only the message, which is the only reason the player has
        // to understand why the screen changed under them.
        if (error.code === ERROR.KICKED) {
            const code = this.#state.code;
            if (code) writeToken(code, null);
            this.#socket?.disconnect();
            this.#socket = null;
            this.#undo.clear();
            clearTimeout(this.#noticeTimer);
            this.#state = { ...initialState(), code, error, connection: 'error' };
            this.#notify();
            return;
        }

        this.#set({ error, connection: 'error' });
    }

    /**
     * Applies an op locally, queues it as pending, sends it, and remembers what the cell held so it
     * can be walked back, unless this op *is* an undo.
     */
    #sendOp(op, current, { record = true } = {}) {
        if (this.#state.room?.state !== ROOM_STATE.PLAYING) return;

        if (record) {
            this.#undo.record({ cell: op.cell, before: current, after: opResult(op, current) });
        }
        this.#retireCheckResults(op);
        this.#setBoard(this.#state.board, [...this.#state.pendingOps, op]);
        this.#set({ canUndo: this.#undo.size > 0 });

        this.#socket?.emit(CLIENT_EVENT.GAME_OP, { op }, (ack) => {
            if (ack?.ok) return;
            // A rejected op never happened: drop it and let the server's state stand.
            this.#setBoard(
                this.#state.board,
                this.#state.pendingOps.filter((pending) => pending.opId !== op.opId),
            );
        });
    }

    /** Drops the check marks on any cell an op touches: a graded cell that changed is not graded. */
    #retireCheckResults(op) {
        const cells = op.cells ?? (op.cell == null ? [] : [op.cell]);
        if (cells.length === 0) return;
        if (!cells.some((cell) => this.#state.checkResults[cell] != null)) return;

        const checkResults = { ...this.#state.checkResults };
        for (const cell of cells) delete checkResults[cell];
        this.#set({ checkResults });
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

    /** Shows a short-lived line of feedback, replacing whatever was there. */
    #notice(text) {
        clearTimeout(this.#noticeTimer);
        this.#set({ notice: { text, id: Date.now() } });
        this.#noticeTimer = setTimeout(() => this.#set({ notice: null }), NOTICE_TIMEOUT_MS);
    }

    /**
     * Stores a new board and pending list, re-deriving the rendered view.
     *
     * Pending ops are stamped above the server's seq so they win locally until their echo lands,
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
