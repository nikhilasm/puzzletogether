/**
 * The file-backed puzzle provider: crossword's half of the supply split (ADR-0004).
 *
 * A generator is asked for a puzzle and makes one. A bank is asked and *finds* one, which makes it a
 * different shape of thing in three ways this module has to answer for:
 *
 * - **Its content is finite and knowable**, so it publishes a catalog and the picker offers what
 *   exists rather than what a constant hoped would exist.
 * - **Its content can be wrong.** A generator's output is correct by construction; a file can be
 *   hand-edited, half-merged, or written by an importer with a bug. Every file is validated on the
 *   way in, including re-deriving its numbering from its own grid.
 * - **Its content repeats.** Thirty puzzles run out, and a room that is handed the puzzle it just
 *   solved will read the button as broken, so take is told what a room has already seen.
 *
 * Loaded once at boot and held in memory. The bank is a few hundred KB at the sizes involved, and
 * re-reading it per puzzle would put file I/O in the path of a host pressing "start".
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_CELL_VALUE_LENGTH } from '../../shared/constants.js';
import { log } from '../log.js';

import { ALPHABET, DOC_VERSION } from './crossword/index.js';
import { checkNumbering } from './crossword/numbering.js';

/** Largest grid the client renders, mirroring schema.js. */
const MAX_SIDE = 25;

/** Every loaded puzzle, by id, as { doc, solution, meta }. Populated by loadBank. */
const puzzles = new Map();

/** Whether loadBank has run, so a second call is a no-op rather than a double load. */
let loaded = false;

/**
 * Validates one bank file, returning the first thing wrong with it.
 *
 * Deliberately thorough about the grid and silent about the writing. Whether a clue is *good* is not
 * a judgement available here; whether the entry it belongs to covers the squares the grid implies
 * very much is, and that is the failure that produces an unsolvable puzzle rather than a dull one.
 *
 * @param {any} file - The parsed contents of a bank file.
 * @returns {string|null} The reason to refuse it, or null when it is sound.
 */
function validatePuzzle(file) {
    const doc = file?.doc;
    const solution = file?.solution;
    if (!doc || typeof doc !== 'object') return 'no doc';
    if (!Array.isArray(solution)) return 'no solution array';
    if (doc.type !== 'crossword') return `type is ${doc.type}, not crossword`;
    if (doc.version !== DOC_VERSION) return `doc version ${doc.version}, expected ${DOC_VERSION}`;

    const size = doc.size;
    if (!size || !Number.isInteger(size.rows) || !Number.isInteger(size.cols)) return 'bad size';
    if (size.rows < 1 || size.cols < 1 || size.rows > MAX_SIDE || size.cols > MAX_SIDE) {
        return `${size.rows}x${size.cols} is outside the ${MAX_SIDE}x${MAX_SIDE} the client renders`;
    }

    const total = size.rows * size.cols;
    if (!Array.isArray(doc.cells) || doc.cells.length !== total) {
        return `expected ${total} cells, found ${doc.cells?.length}`;
    }
    if (solution.length !== total) {
        return `expected ${total} solution entries, found ${solution.length}`;
    }

    const alphabet = doc.meta?.alphabet ?? ALPHABET;
    for (let idx = 0; idx < total; idx += 1) {
        const cell = doc.cells[idx];
        const answer = solution[idx];
        if (!cell || typeof cell !== 'object') return `cell ${idx} is not an object`;

        // A black square has no answer and an open one must have exactly one. Getting this backwards
        // is how an importer bug turns into a puzzle that can never be completed.
        if (cell.block === true) {
            if (answer !== null) return `cell ${idx} is blocked but has an answer`;
            continue;
        }
        if (typeof answer !== 'string' || answer.length < 1) return `cell ${idx} has no answer`;
        if (answer.length > MAX_CELL_VALUE_LENGTH) {
            return `cell ${idx} answers ${answer.length} characters, over the ${MAX_CELL_VALUE_LENGTH} a cell holds`;
        }
        if (![...answer].every((letter) => alphabet.includes(letter))) {
            return `cell ${idx} answers "${answer}", which is not in the alphabet`;
        }
    }

    return checkNumbering(doc);
}

/**
 * Reads one bank directory, skipping it entirely when it does not exist.
 *
 * A missing directory is the normal state of a fresh clone, since data/crosswords-local/ is
 * gitignored, so it is not worth a warning.
 *
 * @param {string} dir - Absolute path to a bank directory.
 * @returns {{ id: string, doc: object, solution: (string|null)[], meta: object }[]} Sound puzzles.
 */
function readDir(dir) {
    if (!existsSync(dir)) return [];

    const manifestPath = join(dir, 'index.json');
    if (!existsSync(manifestPath)) {
        log.warn('bank.dir.skipped', { dir, reason: 'no_manifest' });
        return [];
    }

    let manifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
        log.warn('bank.dir.skipped', { dir, reason: 'invalid_manifest', err: error });
        return [];
    }

    const listed = Array.isArray(manifest?.puzzles) ? manifest.puzzles : [];
    const found = [];

    for (const entry of listed) {
        const file = join(dir, entry.file ?? `${entry.id}.json`);
        if (!existsSync(file)) {
            log.warn('bank.puzzle.refused', { id: entry.id, file, reason: 'missing' });
            continue;
        }

        let parsed;
        try {
            parsed = JSON.parse(readFileSync(file, 'utf8'));
        } catch (error) {
            log.warn('bank.puzzle.refused', {
                id: entry.id,
                file,
                reason: 'invalid_json',
                err: error,
            });
            continue;
        }

        // One bad file is refused; the rest of the bank still loads. A single malformed puzzle
        // taking the whole app down is a worse failure than serving 29 of 30. Said out loud,
        // because a bank quietly one puzzle short is how this rots.
        const problem = validatePuzzle(parsed);
        if (problem) {
            log.warn('bank.puzzle.refused', { id: entry.id, reason: 'unsound', problem });
            continue;
        }

        found.push({
            id: entry.id ?? parsed.doc.id,
            doc: parsed.doc,
            solution: parsed.solution,
            meta: {
                title: entry.title ?? parsed.doc.title ?? null,
                author: entry.author ?? parsed.doc.author ?? null,
                source: entry.source ?? null,
                license: entry.license ?? 'unknown',
                difficulty: parsed.doc.difficulty,
                size: parsed.doc.size,
            },
        });
    }

    return found;
}

/**
 * Loads every bank directory into memory. Safe to call more than once.
 *
 * @param {string[]} dirs - Absolute paths, in order; a later directory's puzzle wins on id collision.
 * @returns {number} How many puzzles the bank holds.
 */
export function loadBank(dirs) {
    if (loaded) return puzzles.size;

    for (const dir of dirs) {
        for (const puzzle of readDir(dir)) {
            // Later directories win, so a local copy can stand in for a tracked one during work.
            puzzles.set(puzzle.id, puzzle);
        }
    }

    loaded = true;
    return puzzles.size;
}

/**
 * What the bank can actually serve, as Puzzle Select needs to offer it.
 *
 * **puzzles is the part that matters, and it is what a generator can never supply.** A bank's
 * content is finite and knowable, so the host picks a *puzzle* by title, by whoever wrote it, or by
 * where it came from, rather than describing one and hoping (ADR-0009). Sizes and difficulties are
 * still published beside it: they are what the room's settings record, and what "start another"
 * falls back to when the named puzzle has since gone.
 *
 * The solution is emphatically not in here. This is a browsing list, sent to every player on join,
 * and it carries only what is printed above a crossword in a newspaper.
 *
 * @returns {{ sizes: { rows: number, cols: number }[], difficulties: string[],
 *   puzzles: { id: string, title: string|null, author: string|null, source: string|null,
 *   size: { rows: number, cols: number }, difficulty: string }[] }|null} What is on offer, or null
 *   when the bank holds nothing, in which case the type is not offered at all.
 */
export function bankCatalog() {
    if (puzzles.size === 0) return null;

    const sizes = new Map();
    const difficulties = new Set();
    for (const { doc } of puzzles.values()) {
        sizes.set(`${doc.size.rows}x${doc.size.cols}`, {
            rows: doc.size.rows,
            cols: doc.size.cols,
        });
        difficulties.add(doc.difficulty);
    }

    // Smallest first, then alphabetical: a list a host scrolls should be ordered by the thing they
    // are choosing between, and on a bank of minis and 15×15s that is the size before the title.
    const listed = [...puzzles.values()]
        .map(({ id, meta }) => ({
            id,
            title: meta.title,
            author: meta.author,
            source: meta.source,
            size: meta.size,
            difficulty: meta.difficulty,
        }))
        .sort(
            (a, b) =>
                a.size.rows * a.size.cols - b.size.rows * b.size.cols ||
                (a.title ?? a.id).localeCompare(b.title ?? b.id),
        );

    return {
        sizes: [...sizes.values()].sort((a, b) => a.rows * a.cols - b.rows * b.cols),
        difficulties: [...difficulties],
        puzzles: listed,
    };
}

/**
 * Picks a puzzle matching a request, preferring one the room has not seen.
 *
 * **A named id wins outright**, because the host picked that puzzle off a list rather than
 * describing one; honouring the description instead would hand back a different crossword from the
 * one whose title they pressed. It falls back to the description when the id names nothing, which is
 * a client holding a catalog older than the bank rather than a mistake worth failing a start over.
 *
 * Without an id the match loosens rather than failing. Size is honoured exactly, because a host who
 * asked for a 15×15 and got a mini has been given the wrong puzzle; difficulty is a preference,
 * because a bank of a dozen files cannot promise every combination and the document's own label is
 * what the game screen displays either way. That is the same bargain sudoku already makes when its
 * generator misses the requested band.
 *
 * @param {object} spec - What was asked for.
 * @param {string} [spec.id] - A specific puzzle the host chose off the catalog.
 * @param {string} spec.difficulty - Preferred difficulty.
 * @param {import('../../shared/protocol.js').GridSize} spec.size - Required grid dimensions.
 * @param {Iterable<string>} [spec.exclude] - Puzzle ids this room has already been served.
 * @returns {{ doc: object, solution: (string|null)[] }} A deep copy, so a room editing its document
 *   cannot alter the bank every later room reads.
 * @throws {RangeError} If the bank holds nothing of that size.
 */
export function takeFromBank({ id = null, difficulty, size, exclude = [] }) {
    const named = id ? puzzles.get(id) : null;
    if (named) return structuredClone({ doc: named.doc, solution: named.solution });

    const seen = new Set(exclude);
    const bySize = [...puzzles.values()].filter(
        (entry) => entry.doc.size.rows === size.rows && entry.doc.size.cols === size.cols,
    );
    if (bySize.length === 0) {
        throw new RangeError(`the bank holds no ${size.rows}x${size.cols} crossword`);
    }

    const unseen = bySize.filter((entry) => !seen.has(entry.id));
    // Everything has been played: repeating beats refusing to start, so the room begins again.
    const pool = unseen.length > 0 ? unseen : bySize;
    const preferred = pool.filter((entry) => entry.doc.difficulty === difficulty);
    const choices = preferred.length > 0 ? preferred : pool;
    const chosen = choices[Math.floor(Math.random() * choices.length)];

    return structuredClone({ doc: chosen.doc, solution: chosen.solution });
}

/** Empties the bank, so a test can load a fixture directory of its own. */
export function resetBank() {
    puzzles.clear();
    loaded = false;
}
