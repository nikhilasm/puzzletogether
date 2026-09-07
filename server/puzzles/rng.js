/**
 * Seeded pseudo-random number generation for puzzle creation; generators never call Math.random()
 * but take an injected rng, which makes a puzzle reproducible and generator tests deterministic
 * (code-style.md §7). The shuffle is carried over from the prototype, seeded rather than global.
 */

import { randomInt } from 'node:crypto';

/**
 * @typedef {object} Rng
 * @property {number} seed - The seed this generator was created from.
 * @property {() => number} next - Next float in [0, 1).
 * @property {(maxExclusive: number) => number} int - Next integer in [0, maxExclusive).
 * @property {<T>(items: T[]) => T[]} shuffle - Fisher-Yates shuffle, in place.
 */

/**
 * Creates a seeded random generator (mulberry32: small, fast, and good enough for puzzle
 * layout, not for anything security-relevant).
 *
 * @param {number} seed - 32-bit seed. The same seed always produces the same sequence.
 * @returns {Rng} A generator carrying its seed.
 */
export function createRng(seed) {
    let state = seed >>> 0;

    // Advances the internal state and returns the next float in [0, 1).
    function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Returns the next integer in [0, maxExclusive).
    function int(maxExclusive) {
        return Math.floor(next() * maxExclusive);
    }

    // Shuffles an array in place and returns it.
    function shuffle(items) {
        for (let i = items.length - 1; i > 0; i -= 1) {
            const j = int(i + 1);
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }

    return { seed, next, int, shuffle };
}

/**
 * Draws a fresh seed for a new puzzle. This is the one place randomness enters generation; every
 * step after it is a pure function of the seed.
 *
 * @returns {number} A random 32-bit seed.
 */
export function randomSeed() {
    return randomInt(0, 2 ** 31);
}
