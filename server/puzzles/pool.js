/**
 * Pre-warmed puzzle pools generated in a worker thread, so getPuzzle is a pop rather than a
 * computation (design-spec.md §8), falling back to in-process generation when the pool is dry or the
 * worker is down. It is also where a puzzle is held to the difficulty asked for, redrawing since the
 * generators measure difficulty rather than dialling it in (ADR-0017).
 */

import { Worker } from 'node:worker_threads';

import { DIFFICULTIES } from '../../shared/constants.js';
import { log } from '../log.js';

import kakuro from './kakuro/index.js';
import kenken from './kenken/index.js';
import nonogram from './nonogram/index.js';
import { createRng, randomSeed } from './rng.js';
import sudoku from './sudoku/index.js';
import suguru from './suguru/index.js';

/** Types this pool can generate in-process as a fallback. */
const MODULES = { sudoku, kenken, nonogram, kakuro, suguru };

/**
 * Independent draws to spend looking for the difficulty asked for, bounded since a difficulty can be
 * unreachable at a size rather than merely rare. Ten is enough that every reachable band comes back
 * on target, and cheap where spent in full since the unreachable cases are all small sudoku.
 */
const DIFFICULTY_ATTEMPTS = 10;

/** The pool key for a puzzle specification. */
function poolKey({ type, difficulty, size }) {
    return `${type}:${difficulty}:${size.rows}x${size.cols}`;
}

/** How far a measured difficulty sits from the one asked for, counted in bands. */
function bandsApart(measured, wanted) {
    return Math.abs(DIFFICULTIES.indexOf(measured) - DIFFICULTIES.indexOf(wanted));
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
     * The puzzle is on the difficulty asked for unless that difficulty is unreachable at that size,
     * in which case it is the nearest band and the pool has said so on the console.
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
     * @param {object} spec - Puzzle specification, as for take.
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

    /** Tops the pool up to targetSize, counting generations already in flight. */
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
                    // A refill nobody is waiting on, so the room that asked was served; what it
                    // costs is the next take being a cold generation on the request path.
                    log.error('puzzle.generate.failed', { spec: key, err: error });
                })
                .finally(() => {
                    this.#inFlight.set(key, Math.max(0, (this.#inFlight.get(key) ?? 1) - 1));
                });
        }
    }

    /**
     * Draws until the puzzle measures at the difficulty asked for, then settles for the nearest, its
     * whole contribution over each generator's own search being a fresh seed. Settling rather than
     * failing keeps generation total, costing an unsatisfiable request a puzzle one band away rather
     * than none at all.
     */
    async #generate(spec) {
        let best = null;

        for (let attempt = 0; attempt < DIFFICULTY_ATTEMPTS; attempt += 1) {
            const puzzle = await this.#draw(spec);
            if (puzzle.doc.difficulty === spec.difficulty) return puzzle;

            const nearer =
                !best ||
                bandsApart(puzzle.doc.difficulty, spec.difficulty) <
                    bandsApart(best.doc.difficulty, spec.difficulty);
            if (nearer) best = puzzle;
        }

        log.warn('puzzle.difficulty.settled', {
            spec: poolKey(spec),
            wanted: spec.difficulty,
            served: best.doc.difficulty,
            draws: DIFFICULTY_ATTEMPTS,
        });
        return best;
    }

    /** Generates one puzzle in the worker, falling back to this process if the worker is down. */
    async #draw(spec) {
        const seed = randomSeed();
        try {
            return await this.#generateInWorker({ ...spec, seed });
        } catch (error) {
            log.warn('puzzle.worker.fallback', { spec: poolKey(spec), err: error });
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
        worker.on('error', (error) => {
            log.error('puzzle.worker.died', { pending: this.#pending.size, err: error });
            this.#failAllPending(error);
        });
        worker.on('exit', (code) => {
            // A worker this pool released is already off the field, and close() terminating it is
            // a nonzero exit that means nothing. An exit while it is still the current worker is
            // the one worth saying out loud: generation has moved onto the event loop.
            const wasReleased = this.#worker !== worker;
            this.#worker = null;
            if (code === 0 || wasReleased) return;

            log.error('puzzle.worker.died', { code, pending: this.#pending.size });
            this.#failAllPending(new Error(`generator worker exited (${code})`));
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
 * @param {object} spec - Puzzle specification plus an explicit seed.
 * @returns {{ doc: import('../../shared/protocol.js').PuzzleDoc, solution: string[] }} A puzzle.
 * @throws {RangeError} If no generator exists for the requested type.
 */
export function generateInline({ type, difficulty, size, seed }) {
    const module = MODULES[type];
    if (!module) throw new RangeError(`no generator for type: ${type}`);
    return module.create({ difficulty, size, rng: createRng(seed ?? randomSeed()) });
}
