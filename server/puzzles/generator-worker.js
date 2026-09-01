/**
 * Worker-thread entry point for puzzle generation.
 *
 * Generation, and specifically uniqueness verification, is CPU-bound, so it runs here rather
 * than on the event loop where it would stall every socket in every room (architecture.md §1).
 */

import { parentPort } from 'node:worker_threads';

import kakuro from './kakuro/index.js';
import kenken from './kenken/index.js';
import nonogram from './nonogram/index.js';
import { createRng } from './rng.js';
import sudoku from './sudoku/index.js';

/** Every type this worker can generate, keyed by doc.type. */
const MODULES = { sudoku, kenken, nonogram, kakuro };

/** Generates one puzzle and posts it back, converting a thrown error into a reply. */
function handleRequest({ id, type, difficulty, size, seed }) {
    try {
        const module = MODULES[type];
        if (!module) throw new RangeError(`no generator for type: ${type}`);
        const { doc, solution } = module.create({ difficulty, size, rng: createRng(seed) });
        parentPort.postMessage({ id, doc, solution });
    } catch (error) {
        parentPort.postMessage({ id, error: error.message });
    }
}

parentPort.on('message', handleRequest);
