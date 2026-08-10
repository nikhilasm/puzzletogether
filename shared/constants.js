/**
 * Values that client and server must agree on exactly: palette size, room limits, and timings.
 *
 * Runs in both environments, so nothing here may touch `window`, `process`, or the filesystem.
 */

/** Shown in the About dialog. Keep in step with `package.json`'s `version`. */
export const APP_VERSION = '0.1.0';

/** Repository link in the footer, and in About. */
export const GITHUB_URL = 'https://github.com/nmurthy99/puzzletogether';

/**
 * Where "Report an issue" goes.
 *
 * Derived from `GITHUB_URL` rather than written out, so moving the repository moves both links.
 * `/issues/new` rather than `/issues`: somebody who has clicked this has already decided.
 */
export const ISSUES_URL = `${GITHUB_URL}/issues/new`;

/** Number of distinct player identities. Colour hexes live in `client/styles/tokens.css`. */
export const PLAYER_COLOR_COUNT = 10;

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
    'sky',
    'grey',
];

/** Room codes are 4 lowercase characters (design-spec.md §9). */
export const ROOM_CODE_LENGTH = 4;

/** `l` and `o` are omitted because they are unreadable next to `1` and `0`. */
export const ROOM_CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz';

/**
 * Beyond this the player chips stop fitting the 640px column.
 *
 * It used to be the palette's size too, and no longer is: there are ten colours and eight seats, so
 * a room always has spare colours to change *to*. Raising this is now a layout question rather than
 * a palette one, but it stays where it is until the roster is proved at that width.
 */
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

/**
 * Token bucket for Check and Reveal. Slow on purpose: each one reads the solution and moves the
 * room's assist count, so a burst of three then one every two seconds is more than play needs.
 */
export const ASSIST_RATE_LIMIT = { capacity: 3, refillPerSecond: 0.5 };

/**
 * Longest value a single cell may hold on the wire.
 *
 * Was one character through Phase 3, and three types are still built on that — they enforce it
 * themselves, in their own `validateOp`. This bound is about what may cross the wire, not about what
 * a puzzle means: a crossword rebus square holds a whole word, and 8 characters comfortably covers
 * every rebus in ordinary use while keeping the payload bounded. → ADR-0007
 *
 * **A puzzle type must bound its own values.** Nothing here will do it for you any more.
 */
export const MAX_CELL_VALUE_LENGTH = 8;

/** Every puzzle type this build can serve. */
export const PUZZLE_TYPES = ['sudoku', 'kenken', 'nonogram', 'crossword'];

/**
 * How each type is written when shown to a player.
 *
 * A map rather than capitalising the wire value, because "KenKen" has a capital in the middle and
 * no rule derives it. The wire value stays lowercase everywhere else.
 */
export const PUZZLE_TYPE_NAMES = {
    sudoku: 'Sudoku',
    kenken: 'KenKen',
    nonogram: 'Nonogram',
    crossword: 'Crossword',
};

/** Difficulties every generated type must support. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Grid sides each **generated** type offers in Puzzle Select, smallest first.
 *
 * KenKen stops at 7 because uniqueness verification is its expensive step and climbs sharply with
 * size — measured at ~170ms median for a 7×7 hard against ~1ms for a 5×5 (docs/TODO.md).
 *
 * **Crossword is absent on purpose.** A generator can produce any size it offers, so a constant can
 * state them; a bank offers whatever files it was given, which nothing here can know. Crossword's
 * sizes reach Puzzle Select through the provider's catalog, and they are `{ rows, cols }` pairs
 * rather than sides — a real crossword is 15×15 or 5×5 and also 20×21 (design-spec.md §7).
 */
export const SIZES_BY_TYPE = {
    sudoku: [4, 6, 9],
    kenken: [4, 5, 6, 7],
    nonogram: [5, 10, 15, 20],
};

/**
 * Sizes that are offered but come with a caveat, per type.
 *
 * A 20×20 nonogram fits a 320px screen without overflowing, but only by shrinking its squares to
 * about ten pixels with the clue gutters taking a third of the width. That is a fine puzzle on a
 * laptop and a poor one on a phone — a difference the host cannot see when they are the one on the
 * laptop, and the rest of the room is not. So it is offered with the trade-off stated rather than
 * withheld or left to be discovered after everyone has started.
 */
export const SIZE_CAUTION = {
    nonogram: {
        above: 15,
        message: 'the squares get very small on a phone — best played on a larger screen',
    },
};

/**
 * Smallest grid side, per type, on which a difficulty request means anything.
 *
 * A 4×4 or 6×6 sudoku falls to naked and hidden singles however hard you dig it — there is no room
 * for a technique beyond them — so every small grid measures `easy`. Rather than accept a request it
 * cannot honour, Puzzle Select disables the difficulty picker below this side.
 *
 * KenKen and nonogram have no such floor: their difficulty is carried by cage shapes and clue
 * density, which mean something at every size they offer. The entry is still listed for each type so
 * that adding a type forces an answer rather than defaulting to one.
 */
export const DIFFICULTY_MIN_SIDE = {
    sudoku: 9,
    kenken: 4,
    nonogram: 5,
    // Crossword's difficulty is neither measured nor a generation parameter — it is declared in the
    // bank manifest, because difficulty in a crossword is how obscure the clues are and that is a
    // property of the writing. Size has nothing to do with it, so there is no floor to set.
    crossword: 0,
};

/** How many of a player's own ops stay undoable. Deep enough to fix a bad run, not a whole solve. */
export const UNDO_DEPTH = 50;

/** How long a transient notice ("that cell has changed since") stays on screen. */
export const NOTICE_TIMEOUT_MS = 3500;

/** What a room starts a puzzle with when nobody has chosen otherwise. */
export const DEFAULT_SETTINGS = {
    type: 'sudoku',
    difficulty: 'medium',
    size: { rows: 9, cols: 9 },
    checkingAllowed: true,
    revealAllowed: true,
};
