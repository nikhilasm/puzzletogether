/**
 * The provider seam: the only entry point the rest of the server uses to obtain a puzzle, hiding
 * whether it was generated or read off disk (ADR-0004). What the banked kind adds is catalog(),
 * since a bank offers whatever files it was given, which no constant can state.
 */

import { SIZES_BY_TYPE, DIFFICULTIES, PUZZLE_TYPES } from '../../shared/constants.js';

import { bankCatalog, loadBank, takeFromBank } from './bank.js';
import crossword from './crossword/index.js';
import kakuro from './kakuro/index.js';
import kenken from './kenken/index.js';
import nonogram from './nonogram/index.js';
import { GeneratorPool } from './pool.js';
import sudoku from './sudoku/index.js';
import suguru from './suguru/index.js';

/** Puzzle modules by type. A further type is one import and one entry. */
const MODULES = { sudoku, kenken, nonogram, kakuro, crossword, suguru };

/** Which producer serves each type, the whole of what getPuzzle has to decide. */
const PROVIDER_BY_TYPE = {
    sudoku: 'generator',
    kenken: 'generator',
    nonogram: 'generator',
    kakuro: 'generator',
    crossword: 'bank',
    suguru: 'generator',
};

const pool = new GeneratorPool();

/**
 * Reads the crossword bank into memory. Called once at boot, before the first room can ask.
 *
 * @param {string[]} dirs - Bank directories, in order.
 * @returns {number} How many puzzles were loaded.
 */
export function loadBankFrom(dirs) {
    return loadBank(dirs);
}

/**
 * Fetches a puzzle matching the requested specification.
 *
 * @param {object} spec - Puzzle specification.
 * @param {string} spec.type - Puzzle type, one of the supported modules.
 * @param {string} spec.difficulty - Requested difficulty.
 * @param {import('../../shared/protocol.js').GridSize} spec.size - Grid dimensions.
 * @param {string} [spec.puzzleId] - A specific puzzle the host chose off the catalog. Only a bank
 *   can honour it; a generator has no list to choose from, so it ignores it (ADR-0009).
 * @param {Iterable<string>} [spec.exclude] - Puzzle ids the asking room has already been served, so
 *   a finite bank does not hand back the puzzle just solved. Generators ignore it; they do not
 *   repeat.
 * @returns {Promise<{ doc: import('../../shared/protocol.js').PuzzleDoc, solution: string[] }>}
 *   The client-safe document and the solution, which the room keeps and never serialises.
 * @throws {RangeError} If no provider serves the requested type.
 */
export async function getPuzzle({ type, difficulty, size, puzzleId, exclude }) {
    const provider = PROVIDER_BY_TYPE[type];
    if (provider === 'generator') return pool.take({ type, difficulty, size });
    if (provider === 'bank') return takeFromBank({ id: puzzleId, difficulty, size, exclude });
    throw new RangeError(`no provider for puzzle type: ${type}`);
}

/**
 * What this build can actually serve, per type, for Puzzle Select to offer; a type with nothing
 * behind it is left out, which for crossword is the ordinary no-bank state rather than an error
 * (ADR-0004). A banked type also lists its puzzles by name, the difference between describing a
 * puzzle and choosing one (ADR-0009).
 *
 * @returns {Object<string, { sizes: { rows: number, cols: number }[], difficulties: string[],
 *   puzzles?: object[] }>} What is available, keyed by puzzle type.
 */
export function catalog() {
    const available = {};

    for (const type of PUZZLE_TYPES) {
        if (PROVIDER_BY_TYPE[type] === 'bank') {
            const banked = bankCatalog();
            if (banked) available[type] = banked;
            continue;
        }

        const sides = SIZES_BY_TYPE[type] ?? [];
        if (sides.length === 0) continue;
        available[type] = {
            sizes: sides.map((side) => ({ rows: side, cols: side })),
            difficulties: [...DIFFICULTIES],
        };
    }

    return available;
}

/**
 * The module implementing a puzzle type, for op validation and completion checks.
 *
 * @param {string} type - Puzzle type.
 * @returns {object|null} The puzzle module, or null when the type is unknown.
 */
export function getPuzzleModule(type) {
    return MODULES[type] ?? null;
}

/**
 * Warms the pool for a specification at boot, so the first puzzle of a process is as fast as the
 * rest.
 *
 * A banked type is already warm, being a map in memory, so this is a no-op for crossword rather
 * than something every call site has to remember not to ask for.
 *
 * @param {object} spec - Puzzle specification, as for getPuzzle.
 * @returns {void}
 */
export function prewarm(spec) {
    if (PROVIDER_BY_TYPE[spec.type] !== 'generator') return;
    pool.prewarm(spec);
}

/**
 * Releases the generator worker. Called during shutdown.
 *
 * @returns {Promise<void>} Resolves when the worker has stopped.
 */
export async function closeProvider() {
    await pool.close();
}
