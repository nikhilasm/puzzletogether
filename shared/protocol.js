/**
 * The wire contract: event names, error codes, and a `@typedef` for every payload shape.
 *
 * Single source of truth for both sides (ADR-0006). `shared/schema.js` validates the same shapes
 * at runtime; when one changes, the other changes in the same commit.
 */

/**
 * Bumped on any breaking payload change. Travels in the handshake; a mismatch returns a
 * "please refresh" error rather than failing mysteriously after a deploy.
 */
export const PROTOCOL_VERSION = 1;

/** Client → server events. Every one takes an ack callback. */
export const CLIENT_EVENT = {
    ROOM_CREATE: 'room:create',
    ROOM_JOIN: 'room:join',
    ROOM_LEAVE: 'room:leave',
    GAME_START: 'game:start',
    GAME_OP: 'game:op',
    GAME_FOCUS: 'game:focus',
    SYNC_REQUEST: 'sync:request',
};

/** Server → client events. Broadcast; never acked. */
export const SERVER_EVENT = {
    ROOM_JOINED: 'room:joined',
    ROOM_STATE: 'room:state',
    ROOM_PLAYERS: 'room:players',
    ROOM_HOST: 'room:host',
    GAME_STARTED: 'game:started',
    GAME_SNAPSHOT: 'game:snapshot',
    GAME_OP: 'game:op',
    GAME_FOCUS: 'game:focus',
    GAME_SOLVED: 'game:solved',
    ERROR: 'error',
};

/** Structured ack error codes. Never inline a message string as an identifier. */
export const ERROR = {
    BAD_PAYLOAD: 'BAD_PAYLOAD',
    PROTOCOL_MISMATCH: 'PROTOCOL_MISMATCH',
    ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
    ROOM_FULL: 'ROOM_FULL',
    NOT_IN_ROOM: 'NOT_IN_ROOM',
    SEAT_TAKEN: 'SEAT_TAKEN',
    NOT_HOST: 'NOT_HOST',
    WRONG_STATE: 'WRONG_STATE',
    INVALID_OP: 'INVALID_OP',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL: 'INTERNAL',
};

/** Op types a client may send. `fill` is batched multi-cell (nonogram drag), unused in Phase 1. */
export const OP_TYPE = {
    SET: 'set',
    MARKS: 'marks',
    CLEAR: 'clear',
    FILL: 'fill',
};

/** Room lifecycle states (architecture.md §2). */
export const ROOM_STATE = {
    SELECT: 'select',
    PLAYING: 'playing',
    SOLVED: 'solved',
};

/**
 * @typedef {object} GridSize
 * @property {number} rows - Row count.
 * @property {number} cols - Column count.
 */

/**
 * @typedef {object} DocCell
 * @property {boolean} block - True for a structurally blocked cell (crossword black square).
 * @property {string|null} given - A value fixed by the puzzle; not editable.
 * @property {string|null} label - Small label drawn in the cell's top-left (cage or clue number).
 */

/**
 * The client-safe puzzle document. Never carries solution values (architecture.md §5).
 *
 * @typedef {object} PuzzleDoc
 * @property {string} id - Unique id for this puzzle instance.
 * @property {string} type - Puzzle type, e.g. `'sudoku'`.
 * @property {number} version - Document schema version.
 * @property {GridSize} size - Grid dimensions.
 * @property {string} difficulty - One of `DIFFICULTIES`.
 * @property {string|null} title - Human title, for banked puzzles.
 * @property {string|null} author - Author, for banked puzzles.
 * @property {string} source - `'generated'` or `'bank'`.
 * @property {number|null} seed - Seed that reproduces a generated puzzle.
 * @property {DocCell[]} cells - `rows * cols` cells in row-major order.
 * @property {object} meta - Type-specific data (sudoku: `regionRows`, `regionCols`, `alphabet`).
 */

/**
 * @typedef {object} CellState
 * @property {string|null} value - The entered value, or null when cleared.
 * @property {number[]} marks - Pencil marks, ascending, set semantics.
 * @property {string|null} by - `playerId` of the last writer; kept for the solved screen, never
 *   used to tint values (brand.md §3).
 * @property {number} seq - Server sequence number of the write that produced this cell.
 */

/**
 * @typedef {object} BoardState
 * @property {number} seq - Highest sequence number applied to this board.
 * @property {Object<number, CellState>} cells - Sparse map of cell index to state.
 */

/**
 * A client-originated op. `opId` is client-generated and echoed back so the sender can retire its
 * pending copy.
 *
 * @typedef {object} Op
 * @property {string} opId - Client-unique id for this op.
 * @property {string} t - One of `OP_TYPE`.
 * @property {number} [cell] - Target cell index for `set`, `marks`, and `clear`.
 * @property {number[]} [cells] - Target cell indices for `fill`.
 * @property {string|null} [value] - New value for `set` and `fill`.
 * @property {number[]} [marks] - Full replacement mark set for `marks`.
 */

/**
 * A server-stamped op, as broadcast to every client in the room.
 *
 * @typedef {Op & { seq: number, by: string, at: number }} StampedOp
 */

/**
 * @typedef {object} PlayerView
 * @property {string} id - Server-assigned player id.
 * @property {string} name - Display name; may collide, carries no authority.
 * @property {number} colorIndex - Index into the per-theme player palette.
 * @property {boolean} connected - False while inside the disconnect grace period.
 */

/**
 * @typedef {object} RoomView
 * @property {string} code - The 4-character room code.
 * @property {string} state - One of `ROOM_STATE`.
 * @property {string} hostId - `playerId` of the current host.
 * @property {PlayerView[]} players - Everyone holding a seat, connected or not.
 * @property {number} streak - Consecutive puzzles this room has solved.
 * @property {object} settings - Room settings; `type`, `difficulty`, `size`.
 */

/**
 * Everything a joining or resyncing client needs to render the current puzzle.
 *
 * @typedef {object} Snapshot
 * @property {PuzzleDoc|null} doc - The current puzzle, or null in `select`.
 * @property {BoardState} board - Authoritative board at `board.seq`.
 * @property {number|null} startedAt - Server clock at puzzle start, for the local timer.
 * @property {number} serverNow - Server clock at send time, used to compute the client offset.
 * @property {Object<string, number>} focus - `playerId` to focused cell index.
 */

/**
 * @typedef {object} AckError
 * @property {string} code - One of `ERROR`.
 * @property {string} message - Human-readable detail; never parsed by the client.
 */

/**
 * @typedef {{ ok: true, data?: any } | { ok: false, error: AckError }} Ack
 */

/**
 * Builds a failed ack. Handlers return these instead of throwing — a throw inside a Socket.IO
 * handler kills the connection (code-style.md §8).
 *
 * @param {string} code - One of `ERROR`.
 * @param {string} message - Human-readable detail.
 * @returns {Ack} A failed ack, ready to pass to the callback.
 */
export function fail(code, message) {
    return { ok: false, error: { code, message } };
}

/**
 * Builds a successful ack.
 *
 * @param {any} [data] - Optional payload for the caller.
 * @returns {Ack} A successful ack.
 */
export function ok(data) {
    return { ok: true, data };
}
