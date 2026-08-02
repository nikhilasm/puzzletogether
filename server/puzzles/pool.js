/**
 * Pre-warmed puzzle pools, generated in a worker thread.
 *
 * Keeps a small stock of ready puzzles per (type, difficulty, size) so `getPuzzle` is a pop rather
 * than a computation — which is what makes the host pressing "new puzzle" feel instant
 * (design-spec.md §8). Falls back to in-process generation when the pool is dry or the worker is
 * unavailable, so a worker failure degrades latency rather than breaking the game.
 */

import { Worker } from 'node:worker_threads';

import { createRng, randomSeed } from './rng.js';
import sudoku from './sudoku/index.js';

/** Types this pool can generate in-process as a fallback. */
const MODULES = { sudoku };

/** The pool key for a puzzle specification. */
function poolKey({ type, difficulty, size }) {
    return `${type}:${difficulty}:${size.rows}x${size.cols}`;
}

/**
 * Owns the generator worker and the ready-puzzle stock.
 *
 * Does not know what a room is: callers ask for a puzzle matching a specification and get one.
 */
export class GeneratorPool {
    #worker = null;
    #pending = new Map();
    #ready = new Map();
    #inFlight = new Map();
    #nextRequestId = 1;
    #targetSize;

    /**
     * @param {object} [options] - Pool options.
     * @param {number} [options.targetSize] - Ready puzzles to keep per specification.
     */
    constructor({ targetSize = 2 } = {}) {
        this.#targetSize = targetSize;
    }

    /**
     * Takes a puzzle matching the specification, generating one if the pool is dry, and starts a
     * background refill either way.
     *
     * @param {object} spec - Puzzle specification.
     * @param {string} spec.type - Puzzle type.
     * @param {string} spec.difficulty - Requested difficulty.
     * @param {import('../../shared/protocol.js').GridSize} spec.size - Grid dimensions.
     * @returns {Promise<{ doc: import('../../shared/protocol.js').PuzzleDoc, solution: string[] }>}
     *   A puzzle document and its solution.
     */
    async take(spec) {
        const key = poolKey(spec);
        const stock = this.#ready.get(key);
        const puzzle = stock?.length ? stock.pop() : await this.#generate(spec);
        this.#refill(spec);
        return puzzle;
    }

    /**
     * Fills the pool for a specification ahead of first use, so the first room of the day is as
     * fast as the tenth.
     *
     * @param {object} spec - Puzzle specification, as for `take`.
     * @returns {void}
     */
    prewarm(spec) {
        this.#refill(spec);
    }

    /**
     * Shuts the worker down. Called on server shutdown and by tests, so a pool never keeps the
     * process alive.
     *
     * @returns {Promise<void>} Resolves once the worker has terminated.
     */
    async close() {
        const worker = this.#worker;
        this.#worker = null;
        this.#pending.clear();
        if (worker) await worker.terminate();
    }

    /** Tops the pool up to `targetSize`, counting generations already in flight. */
    #refill(spec) {
        const key = poolKey(spec);
        const stock = this.#ready.get(key) ?? [];
        const inFlight = this.#inFlight.get(key) ?? 0;
        const needed = this.#targetSize - stock.length - inFlight;

        for (let i = 0; i < needed; i += 1) {
            this.#inFlight.set(key, (this.#inFlight.get(key) ?? 0) + 1);
            this.#generate(spec)
                .then((puzzle) => {
                    const current = this.#ready.get(key) ?? [];
                    current.push(puzzle);
                    this.#ready.set(key, current);
                })
                .catch((error) => {
                    console.warn(`[pool] refill failed for ${key}: ${error.message}`);
                })
                .finally(() => {
                    this.#inFlight.set(key, Math.max(0, (this.#inFlight.get(key) ?? 1) - 1));
                });
        }
    }

    /** Generates one puzzle in the worker, falling back to this process if the worker is down. */
    async #generate(spec) {
        const seed = randomSeed();
        try {
            return await this.#generateInWorker({ ...spec, seed });
        } catch (error) {
            console.warn(`[pool] worker generation failed, falling back inline: ${error.message}`);
            return generateInline({ ...spec, seed });
        }
    }

    /** Posts a generation request to the worker and resolves when its reply comes back. */
    #generateInWorker(request) {
        const worker = this.#ensureWorker();
        const id = this.#nextRequestId;
        this.#nextRequestId += 1;

        return new Promise((resolve, reject) => {
            this.#pending.set(id, { resolve, reject });
            worker.postMessage({ ...request, id });
        });
    }

    /** Starts the worker on first use and wires its reply and failure handling. */
    #ensureWorker() {
        if (this.#worker) return this.#worker;

        const worker = new Worker(new URL('./generator-worker.js', import.meta.url));
        worker.on('message', (reply) => {
            const waiter = this.#pending.get(reply.id);
            if (!waiter) return;
            this.#pending.delete(reply.id);
            if (reply.error) {
                waiter.reject(new Error(reply.error));
            } else {
                waiter.resolve({ doc: reply.doc, solution: reply.solution });
            }
        });
        worker.on('error', (error) => this.#failAllPending(error));
        worker.on('exit', (code) => {
            if (code !== 0) this.#failAllPending(new Error(`generator worker exited (${code})`));
            this.#worker = null;
        });
        // The worker must never be the reason the process stays alive.
        worker.unref();

        this.#worker = worker;
        return worker;
    }

    /** Rejects every outstanding request, used when the worker dies mid-flight. */
    #failAllPending(error) {
        for (const waiter of this.#pending.values()) waiter.reject(error);
        this.#pending.clear();
        this.#worker = null;
    }
}

/**
 * Generates a puzzle on the current thread. The pool's fallback path, and what tests use to avoid
 * spinning up a worker.
 *
 * @param {object} spec - Puzzle specification plus an explicit `seed`.
 * @returns {{ doc: import('../../shared/protocol.js').PuzzleDoc, solution: string[] }} A puzzle.
 * @throws {RangeError} If no generator exists for the requested type.
 */
export function generateInline({ type, difficulty, size, seed }) {
    const module = MODULES[type];
    if (!module) throw new RangeError(`no generator for type: ${type}`);
    return module.create({ difficulty, size, rng: createRng(seed ?? randomSeed()) });
}
