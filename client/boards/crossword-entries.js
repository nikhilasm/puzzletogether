/**
 * Which entry a square belongs to, in each direction — the index behind highlighting,
 * auto-advance, and keeping the clue in step with the cursor.
 *
 * **In the client, deliberately, and not in `shared/`** (design-spec.md §7). `shared/` is what
 * *both sides* need, and the server does not need this: a crossword's `validateOp`, `isComplete`,
 * and `checkCells` are the value-grid code sudoku and kenken already share, and none of them ever
 * asks what an entry is. Everything below serves rendering and navigation, which are the board's.
 *
 * `entries[].cells` is stored explicitly in the document, so this is indexing rather than
 * derivation — there is no algorithm here that two sides could implement differently, which is the
 * usual reason to force something into `shared/`.
 */

/**
 * @typedef {{ num: number, dir: 'A'|'D', cells: number[], len: number, clue: string }} Entry
 * @typedef {{ entries: Entry[], byCell: Map<number, { A: number|null, D: number|null }> }} EntryIndex
 */

/** The two directions, in the order clue lists put them. */
export const ACROSS = 'A';
export const DOWN = 'D';

/**
 * Builds the cell-to-entry index for a document.
 *
 * Built once per puzzle and cached by the board, because it is derived from the document rather than
 * from the board state — the black squares do not move while a room is solving, so rebuilding this
 * on every keystroke would be recomputing a constant 15×15 times a second.
 *
 * @param {import('../../shared/protocol.js').PuzzleDoc} doc - A crossword document.
 * @returns {EntryIndex} The entry list and a lookup from cell index to its entry in each direction.
 */
export function indexEntries(doc) {
    const entries = doc?.meta?.entries ?? [];
    const byCell = new Map();

    for (let i = 0; i < entries.length; i += 1) {
        for (const cell of entries[i].cells) {
            const found = byCell.get(cell) ?? { A: null, D: null };
            found[entries[i].dir] = i;
            byCell.set(cell, found);
        }
    }

    return { entries, byCell };
}

/**
 * The entry through a square in a direction, falling back to the other direction.
 *
 * The fallback is not a nicety. A square can belong to an Across entry and no Down one — an unchecked
 * square, common in British-style grids and at the edges of themed American ones — and a cursor
 * pointing Down at such a square has to mean *something*. Answering with the entry that does exist
 * is the only reading that leaves the player somewhere.
 *
 * @param {EntryIndex} index - Built by `indexEntries`.
 * @param {number} cell - Flat cell index.
 * @param {'A'|'D'} dir - Preferred direction.
 * @returns {Entry|null} The entry, or null when the square is in none — a black square.
 */
export function entryAt(index, cell, dir) {
    const found = index.byCell.get(cell);
    if (!found) return null;
    const at = found[dir] ?? found[dir === ACROSS ? DOWN : ACROSS];
    return at == null ? null : index.entries[at];
}

/**
 * Whether a square has an entry running through it in a direction, so the cursor could turn there.
 *
 * @param {EntryIndex} index - Built by `indexEntries`.
 * @param {number} cell - Flat cell index.
 * @param {'A'|'D'} dir - Direction to test.
 * @returns {boolean} True when turning that way lands on a real entry.
 */
export function hasDirection(index, cell, dir) {
    return index.byCell.get(cell)?.[dir] != null;
}

/**
 * The next square to type into after this one, within the same entry.
 *
 * Returns null at the end of the entry rather than running on into the next. Filling the last square
 * of a word is a moment to look up and read a new clue, and being moved somewhere else unannounced
 * is how a player loses their place — the cursor should never end up somewhere they did not ask for
 * and cannot see the reason for.
 *
 * @param {EntryIndex} index - Built by `indexEntries`.
 * @param {number} cell - The square just filled.
 * @param {'A'|'D'} dir - Direction being worked.
 * @returns {number|null} The next square, or null at the end of the entry.
 */
export function nextInEntry(index, cell, dir) {
    const entry = entryAt(index, cell, dir);
    if (!entry) return null;
    const at = entry.cells.indexOf(cell);
    return at >= 0 && at + 1 < entry.cells.length ? entry.cells[at + 1] : null;
}

/**
 * The previous square in the entry, for backing up over what you just typed.
 *
 * @param {EntryIndex} index - Built by `indexEntries`.
 * @param {number} cell - The current square.
 * @param {'A'|'D'} dir - Direction being worked.
 * @returns {number|null} The previous square, or null at the start of the entry.
 */
export function prevInEntry(index, cell, dir) {
    const entry = entryAt(index, cell, dir);
    if (!entry) return null;
    const at = entry.cells.indexOf(cell);
    return at > 0 ? entry.cells[at - 1] : null;
}

/**
 * The entry a Tab press moves to: the next one in the list, wrapping at the end.
 *
 * Tab walks the *whole* clue list rather than staying in one direction, because that is the order
 * the list is printed in and the order a solver reads it — finishing the Across clues and being
 * dropped at the top of the Downs is how paper works.
 *
 * @param {EntryIndex} index - Built by `indexEntries`.
 * @param {Entry|null} from - The entry the cursor is in.
 * @param {number} step - `1` for the next entry, `-1` for the previous.
 * @returns {Entry|null} The entry to move to, or null when the puzzle has none.
 */
export function stepEntry(index, from, step) {
    const { entries } = index;
    if (entries.length === 0) return null;
    const at = from ? entries.indexOf(from) : -1;
    const next = (at + step + entries.length) % entries.length;
    return entries[next];
}

/**
 * The first square of an entry that is still empty, so Tab lands somewhere worth typing.
 *
 * Moving to a clue and landing on a letter already filled in makes the next keystroke overwrite
 * somebody's work — most likely a teammate's, in a room solving together.
 *
 * @param {Entry} entry - The entry being moved to.
 * @param {(cell: number) => string|null} valueOf - Reads a square's current value.
 * @returns {number} A cell index — the first empty square, or the entry's first square when full.
 */
export function firstOpenCell(entry, valueOf) {
    return entry.cells.find((cell) => valueOf(cell) == null) ?? entry.cells[0];
}
