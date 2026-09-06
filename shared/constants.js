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
 * Where "Report an issue" goes.
 *
 * Derived from GITHUB_URL rather than written out, so moving the repository moves both links.
 * /issues/new rather than /issues: somebody who has clicked this has already decided.
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
 * Beyond this the player chips stop fitting the 640px column.
 *
 * Not the palette's size: ten colours against eight seats means a room always has spare colours to
 * change *to*. Raising this is a layout question, not a palette one.
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
 * Longest value a single cell may hold on the wire.
 *
 * This bounds the payload, not what a puzzle means: a crossword rebus square holds a whole word, and
 * 8 characters covers every rebus in ordinary use (ADR-0007). Sudoku, kenken, and nonogram still
 * hold themselves to one character, each in its own validateOp.
 *
 * **A puzzle type must bound its own values.** Nothing here will do it for you.
 */
export const MAX_CELL_VALUE_LENGTH = 8;

/** Every puzzle type this build can serve. */
export const PUZZLE_TYPES = ['sudoku', 'kenken', 'nonogram', 'kakuro', 'crossword', 'suguru'];

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
    kakuro: 'Kakuro',
    crossword: 'Crossword',
    suguru: 'Suguru',
};

/** Difficulties every generated type must support. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Grid sides each **generated** type offers in Puzzle Select, smallest first.
 *
 * KenKen stops at 7 because uniqueness verification is its expensive step and climbs sharply with
 * size: ~170ms median for a 7×7 hard against ~1ms for a 5×5 (docs/TODO.md).
 *
 * **Kakuro's sides count the clue border**, since the border is part of the document: a 9 is a 9×9
 * grid whose first row and column are clue squares, leaving an 8×8 of squares to fill. Stating it in
 * solvable cells would make the picker's numbers disagree with the grid a host is looking at.
 *
 * **Crossword is absent on purpose.** A generator can produce any size it offers, so a constant can
 * state them; a bank offers whatever files it was given. Crossword's sizes reach Puzzle Select
 * through the provider's catalog, as { rows, cols } pairs rather than sides, since a real crossword
 * is 15×15 or 5×5 and also 20×21 (design-spec.md §7).
 */
export const SIZES_BY_TYPE = {
    sudoku: [4, 6, 9],
    kenken: [4, 5, 6, 7],
    nonogram: [5, 10, 15, 20],
    kakuro: [7, 9, 11, 13],
    suguru: [5, 6, 7, 8, 9],
};

/**
 * Sizes that are offered but come with a caveat, per type.
 *
 * A 20×20 nonogram fits a 320px screen only by shrinking its squares to about ten pixels, with the
 * clue gutters taking a third of the width. Fine on a laptop, poor on a phone, and a host on the
 * laptop cannot see the difference. So it is offered with the trade-off stated rather than withheld
 * or left to be discovered after everyone has started.
 */
export const SIZE_CAUTION = {
    nonogram: {
        above: 15,
        message: 'the squares get very small on a phone; best played on a larger screen',
    },
    // Kakuro's caution is a different one at a smaller size: a nonogram square that shrinks is still
    // an empty square, while a kakuro clue square has two numbers and a diagonal printed inside it,
    // so it stops being readable before it stops being clickable.
    kakuro: {
        above: 11,
        message: 'the printed sums get hard to read on a phone; best played on a larger screen',
    },
};

/**
 * Smallest grid side, per type, on which a difficulty request means anything.
 *
 * A 4×4 or 6×6 sudoku falls to naked and hidden singles however hard you dig it, since there is no
 * room for a technique beyond them, so every small grid measures easy. Rather than accept a request
 * it cannot honour, Puzzle Select disables the difficulty picker below this side.
 *
 * KenKen and nonogram have no such floor: their difficulty is carried by cage shapes and clue
 * density, which mean something at every size they offer. The entry is still listed for each type so
 * that adding a type forces an answer rather than defaulting to one.
 */
export const DIFFICULTY_MIN_SIDE = {
    sudoku: 9,
    kenken: 4,
    nonogram: 5,
    // No floor: kakuro's difficulty is carried by how long the rules take to settle the grid, and
    // that separates at every size offered, a 7×7 included. It was 9 while the generator derived its
    // sums from a filled grid, which made a small kakuro measure easy however it was drawn; choosing
    // the clues instead reaches all three levels at 7×7 (ADR-0015).
    kakuro: 0,
    // Crossword difficulty is declared in the bank manifest, not measured: it is how obscure the
    // clues are, which is a property of the writing. Size has nothing to do with it.
    crossword: 0,
    // No floor: suguru's difficulty is carried by its region-size distribution and how far the two
    // rules the solver knows get before a cell is forced, which separates at every size offered,
    // a 5×5 included.
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
