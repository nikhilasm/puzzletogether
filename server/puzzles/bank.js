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
 *   solved will read the button as broken, so `take` is told what a room has already seen.
 *
 * Loaded once at boot and held in memory. The bank is a few hundred KB at the sizes involved, and
 * re-reading it per puzzle would put file I/O in the path of a host pressing "start".
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_CELL_VALUE_LENGTH } from '../../shared/constants.js';

import { ALPHABET, DOC_VERSION } from './crossword/index.js';
import { checkNumbering } from './crossword/numbering.js';

/** Largest grid the client renders, mirroring `schema.js`. */
const MAX_SIDE = 25;

/** Every loaded puzzle, by id, as `{ doc, solution, meta }`. Populated by `loadBank`. */
const puzzles = new Map();

/** Whether `loadBank` has run, so a second call is a no-op rather than a double load. */
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
 * A missing directory is the normal state of a fresh clone — `data/crosswords-local/` is gitignored,
 * so nobody else's checkout has one — and is not worth a warning.
 *
 * @param {string} dir - Absolute path to a bank directory.
 * @returns {{ id: string, doc: object, solution: (string|null)[], meta: object }[]} Sound puzzles.
 */
function readDir(dir) {
    if (!existsSync(dir)) return [];

    const manifestPath = join(dir, 'index.json');
    if (!existsSync(manifestPath)) {
        console.warn(`[bank] ${dir} has no index.json — skipping the directory`);
        return [];
    }

    let manifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
        console.warn(`[bank] ${manifestPath} is not valid JSON: ${error.message}`);
        return [];
    }

    const listed = Array.isArray(manifest?.puzzles) ? manifest.puzzles : [];
    const found = [];

    for (const entry of listed) {
        const file = join(dir, entry.file ?? `${entry.id}.json`);
        if (!existsSync(file)) {
            console.warn(`[bank] ${entry.id}: ${file} is listed in the manifest but missing`);
            continue;
        }

        let parsed;
        try {
            parsed = JSON.parse(readFileSync(file, 'utf8'));
        } catch (error) {
            console.warn(`[bank] ${entry.id}: not valid JSON — ${error.message}`);
            continue;
        }

        // One bad file is refused; the rest of the bank still loads. A bank is content, and a single
        // malformed puzzle taking the whole app down would be a worse failure than serving 29 of 30
        // — but it is said out loud, because a bank quietly one puzzle short is how this rots.
        const problem = validatePuzzle(parsed);
        if (problem) {
            console.warn(`[bank] ${entry.id}: refused — ${problem}`);
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
 * Sizes are `{ rows, cols }` pairs rather than square sides, because real crosswords are 15×15 and
 * 5×5 and also 20×21. Difficulties are the union across the whole type rather than per size: a bank
 * of six puzzles would otherwise offer a different set of buttons for every grid, which reads as the
 * interface flickering rather than as information.
 *
 * @returns {{ sizes: { rows: number, cols: number }[], difficulties: string[] }|null} What is on
 *   offer, or null when the bank holds nothing — in which case the type is not offered at all.
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

    return {
        sizes: [...sizes.values()].sort((a, b) => a.rows * a.cols - b.rows * b.cols),
        difficulties: [...difficulties],
    };
}

/**
 * Picks a puzzle matching a request, preferring one the room has not seen.
 *
 * The match loosens rather than failing. Size is honoured exactly, because a host who asked for a
 * 15×15 and got a mini has been given the wrong puzzle; difficulty is a preference, because a bank
 * of a dozen files cannot promise every combination and the document's own label is what the game
 * screen displays either way. That is the same bargain sudoku already makes when its generator
 * misses the requested band.
 *
 * @param {object} spec - What was asked for.
 * @param {string} spec.difficulty - Preferred difficulty.
 * @param {import('../../shared/protocol.js').GridSize} spec.size - Required grid dimensions.
 * @param {Iterable<string>} [spec.exclude] - Puzzle ids this room has already been served.
 * @returns {{ doc: object, solution: (string|null)[] }} A deep copy, so a room editing its document
 *   cannot alter the bank every later room reads.
 * @throws {RangeError} If the bank holds nothing of that size.
 */
export function takeFromBank({ difficulty, size, exclude = [] }) {
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
