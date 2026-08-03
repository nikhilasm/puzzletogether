/**
 * The provider seam: the only entry point the rest of the server uses to obtain a puzzle.
 *
 * Whether a puzzle was generated in a worker or read off disk is invisible past this line
 * (ADR-0004). Phase 1 has only `GeneratorProvider`; `BankProvider` for crossword drops in here in
 * Phase 4 with no call-site change.
 */

import kenken from './kenken/index.js';
import nonogram from './nonogram/index.js';
import { GeneratorPool } from './pool.js';
import sudoku from './sudoku/index.js';

/** Puzzle modules by type. A fifth type is one import and one entry. */
const MODULES = { sudoku, kenken, nonogram };

/** Which provider serves each type. `BankProvider` joins this map for crossword in Phase 4. */
const PROVIDER_BY_TYPE = { sudoku: 'generator', kenken: 'generator', nonogram: 'generator' };

const pool = new GeneratorPool();

/**
 * Fetches a puzzle matching the requested specification.
 *
 * @param {object} spec - Puzzle specification.
 * @param {string} spec.type - Puzzle type, one of the supported modules.
 * @param {string} spec.difficulty - Requested difficulty.
 * @param {import('../../shared/protocol.js').GridSize} spec.size - Grid dimensions.
 * @returns {Promise<{ doc: import('../../shared/protocol.js').PuzzleDoc, solution: string[] }>}
 *   The client-safe document and the solution, which the room keeps and never serialises.
 * @throws {RangeError} If no provider serves the requested type.
 */
export function getPuzzle({ type, difficulty, size }) {
    if (PROVIDER_BY_TYPE[type] !== 'generator') {
        throw new RangeError(`no provider for puzzle type: ${type}`);
    }
    return pool.take({ type, difficulty, size });
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
 * @param {object} spec - Puzzle specification, as for `getPuzzle`.
 * @returns {void}
 */
export function prewarm(spec) {
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
