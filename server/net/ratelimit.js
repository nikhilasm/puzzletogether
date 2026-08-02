/**
 * Per-socket token buckets for the two event classes that can arrive in floods: cell ops and focus
 * updates (design-spec.md §6).
 *
 * The client throttles focus already; this is the server not taking the client's word for it.
 */

/**
 * A refilling token bucket. One bucket per socket per event class.
 *
 * Deliberately not a queue: an op over the limit is dropped with a `RATE_LIMITED` ack, not delayed,
 * because a late op in a live shared grid is worse than no op.
 */
export class TokenBucket {
    #capacity;
    #refillPerMs;
    #tokens;
    #lastRefillAt;

    /**
     * @param {object} options - Bucket configuration.
     * @param {number} options.capacity - Maximum burst size.
     * @param {number} options.refillPerSecond - Sustained rate.
     */
    constructor({ capacity, refillPerSecond }) {
        this.#capacity = capacity;
        this.#refillPerMs = refillPerSecond / 1000;
        this.#tokens = capacity;
        this.#lastRefillAt = Date.now();
    }

    /**
     * Takes one token if any remain.
     *
     * @returns {boolean} True when the caller may proceed, false when it is rate limited.
     */
    tryConsume() {
        const now = Date.now();
        this.#tokens = Math.min(
            this.#capacity,
            this.#tokens + (now - this.#lastRefillAt) * this.#refillPerMs,
        );
        this.#lastRefillAt = now;

        if (this.#tokens < 1) return false;
        this.#tokens -= 1;
        return true;
    }
}

/**
 * Creates the set of buckets a single socket needs.
 *
 * @param {object} limits - One config object per event class.
 * @returns {Object<string, TokenBucket>} Buckets keyed by the same names as `limits`.
 */
export function createBuckets(limits) {
    return Object.fromEntries(
        Object.entries(limits).map(([name, config]) => [name, new TokenBucket(config)]),
    );
}
