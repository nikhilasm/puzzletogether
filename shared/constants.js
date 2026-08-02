/**
 * Values that client and server must agree on exactly: palette size, room limits, and timings.
 *
 * Runs in both environments, so nothing here may touch `window`, `process`, or the filesystem.
 */

/** Shown in the footer. Keep in step with `package.json`'s `version`. */
export const APP_VERSION = '0.1.0';

/** Repository link in the footer. */
export const GITHUB_URL = 'https://github.com/nmurthy99/puzzletogether';

/** Number of distinct player identities. Colour hexes live in `client/styles/tokens.css`. */
export const PLAYER_COLOR_COUNT = 8;

/**
 * Human names for each colour index, used in aria labels so presence is never conveyed by hue
 * alone (brand.md §3). Index matches `--player-N`.
 */
export const PLAYER_COLOR_NAMES = [
    'crimson',
    'magenta',
    'amber',
    'green',
    'teal',
    'indigo',
    'violet',
    'ochre',
];

/** Room codes are 4 lowercase characters (design-spec.md §9). */
export const ROOM_CODE_LENGTH = 4;

/** `l` and `o` are omitted because they are unreadable next to `1` and `0`. */
export const ROOM_CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz';

/** Beyond this the player chips stop fitting the 640px column and colours would repeat. */
export const MAX_PLAYERS_PER_ROOM = 8;

/** Display names are labels only — they carry no authority (ADR-0005). */
export const MAX_NAME_LENGTH = 20;

/** How long a disconnected player keeps their seat, colour, and host status. */
export const DISCONNECT_GRACE_MS = 120_000;

/** A room with nobody connected for this long is garbage. */
export const ROOM_IDLE_LIMIT_MS = 10 * 60_000;

/** Hard ceiling on room age, so a room nobody closes cannot live forever. */
export const ROOM_MAX_AGE_MS = 12 * 60 * 60_000;

/** How often the garbage collector sweeps for dead rooms. */
export const GC_SWEEP_INTERVAL_MS = 60_000;

/** Client-side throttle on focus broadcasts — ~10/s (design-spec.md §6). */
export const FOCUS_THROTTLE_MS = 100;

/** Token bucket for cell ops: sustained 30/s with a burst allowance for fast typing. */
export const OP_RATE_LIMIT = { capacity: 45, refillPerSecond: 30 };

/** Token bucket for focus updates, one step above the client-side throttle. */
export const FOCUS_RATE_LIMIT = { capacity: 20, refillPerSecond: 15 };

/** Every puzzle type this build can serve. Phase 1 ships sudoku only. */
export const PUZZLE_TYPES = ['sudoku'];

/** Difficulties every generated type must support. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

/** What a room starts a puzzle with when nobody has chosen otherwise. */
export const DEFAULT_SETTINGS = {
    type: 'sudoku',
    difficulty: 'medium',
    size: { rows: 9, cols: 9 },
    checkingAllowed: true,
    revealAllowed: true,
};
