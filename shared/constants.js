/**
 * Values that client and server must agree on exactly: palette size, room limits, and timings.
 *
 * Runs in both environments, so nothing here may touch window, process, or the filesystem.
 */

/** Shown in the About dialog. Keep in step with package.json's version. */
export const APP_VERSION = '1.3.0';

/** Repository link in the footer, and in About. */
export const GITHUB_URL = 'https://github.com/nikhilasm/puzzletogether';

/** The author's own site, linked from the footer toolbar. */
export const HOMEPAGE_URL = 'https://nikmurthy.dev';

/**
 * Where "Report an issue" goes, as /issues/new since a clicker has already decided.
 * Derived from GITHUB_URL so moving the repository moves both links.
 */
export const ISSUES_URL = `${GITHUB_URL}/issues/new`;

/** Number of distinct player identities. Colour hexes live in client/styles/tokens.css. */
export const PLAYER_COLOR_COUNT = 10;

/**
 * Human names for each colour index, used in aria labels so presence is never conveyed by hue
 * alone (brand.md §3). Index matches --player-N.
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

/** l and o are omitted because they are unreadable next to 1 and 0. */
export const ROOM_CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz';

/**
 * Beyond this the player chips stop fitting the 640px column. Not the palette's size: ten colours
 * against eight seats always leaves spare colours to change to, so raising this is a layout question.
 */
export const MAX_PLAYERS_PER_ROOM = 8;

/** Display names are labels only; they carry no authority (ADR-0005). */
export const MAX_NAME_LENGTH = 20;

/** How long a disconnected player keeps their seat, colour, and host status. */
export const DISCONNECT_GRACE_MS = 120_000;

/** A room with nobody connected for this long is garbage. */
export const ROOM_IDLE_LIMIT_MS = 10 * 60_000;

/** Hard ceiling on room age, so a room nobody closes cannot live forever. */
export const ROOM_MAX_AGE_MS = 12 * 60 * 60_000;

/** How often the garbage collector sweeps for dead rooms. */
export const GC_SWEEP_INTERVAL_MS = 60_000;

/** Client-side throttle on focus broadcasts: ~10/s (design-spec.md §6). */
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
 * Longest value a single cell may hold on the wire; bounds the payload, not meaning (a crossword
 * rebus holds a word, ADR-0007). Each puzzle type must still bound its own values in validateOp;
 * nothing here does it for them.
 */
export const MAX_CELL_VALUE_LENGTH = 8;

/** Every puzzle type this build can serve. */
export const PUZZLE_TYPES = ['sudoku', 'kenken', 'nonogram', 'kakuro', 'crossword', 'suguru'];

/**
 * How each type is written when shown to a player. A map rather than capitalising the wire value,
 * since "KenKen" has a mid-word capital no rule derives.
 */
export const PUZZLE_TYPE_NAMES = {
    sudoku: 'Sudoku',
    kenken: 'KenKen',
    nonogram: 'Nonogram',
    kakuro: 'Kakuro',
    crossword: 'Crossword',
    suguru: 'Suguru',
};

/** Difficulties every generated type must support. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Grid sides each generated type offers in Puzzle Select, smallest first. KenKen stops at 7 because
 * uniqueness verification gets expensive, kakuro's sides count the clue border, and crossword is
 * absent because its sizes come from the provider's bank catalog rather than a constant.
 */
export const SIZES_BY_TYPE = {
    sudoku: [4, 6, 9],
    kenken: [4, 5, 6, 7],
    nonogram: [5, 10, 15, 20],
    kakuro: [7, 9, 11, 13],
    suguru: [5, 6, 7, 8, 9],
};

/**
 * Sizes that are offered but come with a caveat, per type. A large nonogram or kakuro is poor on a
 * phone but fine on a laptop, so the trade-off is stated rather than the size withheld.
 */
export const SIZE_CAUTION = {
    nonogram: {
        above: 15,
        message: 'the squares get very small on a phone; best played on a larger screen',
    },
    // Kakuro's caution triggers at a smaller size: a clue square has two numbers and a diagonal
    // printed inside, so it stops being readable before an empty nonogram square would.
    kakuro: {
        above: 11,
        message: 'the printed sums get hard to read on a phone; best played on a larger screen',
    },
};

/**
 * Smallest grid side, per type, on which a difficulty request means anything; below it Puzzle
 * Select disables the difficulty picker. A small sudoku falls to singles whatever the setting, while
 * kenken and nonogram carry difficulty at every size, so every type is listed to force an answer.
 */
export const DIFFICULTY_MIN_SIDE = {
    sudoku: 9,
    kenken: 4,
    nonogram: 5,
    // No floor: kakuro's difficulty separates at every size offered since ADR-0015 chooses the clues
    // rather than deriving sums from a filled grid.
    kakuro: 0,
    // Crossword difficulty is declared in the bank manifest, not measured: it is how obscure the
    // clues are, independent of size.
    crossword: 0,
    // No floor: suguru's difficulty is carried by region-size distribution and solver depth, which
    // separates at every size offered.
    suguru: 0,
};

/** How many of a player's own ops stay undoable. Deep enough to fix a bad run, not a whole solve. */
export const UNDO_DEPTH = 50;

/** How long a transient notice ("undo skipped: that cell has changed since") stays on screen. */
export const NOTICE_TIMEOUT_MS = 3500;

/** What a room starts a puzzle with when nobody has chosen otherwise. */
export const DEFAULT_SETTINGS = {
    type: 'sudoku',
    difficulty: 'medium',
    size: { rows: 9, cols: 9 },
    checkingAllowed: true,
    revealAllowed: true,
};
