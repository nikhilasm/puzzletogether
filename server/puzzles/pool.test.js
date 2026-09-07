/**
 * The pool's one guarantee about content: a puzzle comes back on the difficulty that was asked for.
 * Three of the four generators measure difficulty rather than dialling it in, so a single draw lands
 * off the band often enough to reach a player (ADR-0017); both tests run a real worker with the
 * background refill off (targetSize 0).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeneratorPool } from './pool.js';

/** Grid dimensions from a square side, which is how every generated type states its size. */
function square(side) {
    return { rows: side, cols: side };
}

const pools = [];

/** A pool that generates on demand and keeps no stock, registered for teardown. */
function openPool() {
    const pool = new GeneratorPool({ targetSize: 0 });
    pools.push(pool);
    return pool;
}

afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.close()));
    vi.restoreAllMocks();
});

describe('taking a puzzle at a difficulty', () => {
    /**
     * Kakuro at 7×7 hard is the case that motivated this: its interior is 6×6 with runs capped at
     * four, so there is little room to be hard and a draw came back hard 7 times in 12. Four takes
     * in a row is a test the old pool would have failed about nine times in ten.
     */
    it('redraws until the puzzle measures at the difficulty asked for', async () => {
        const pool = openPool();

        for (let i = 0; i < 4; i += 1) {
            const { doc } = await pool.take({
                type: 'kakuro',
                difficulty: 'hard',
                size: square(7),
            });
            expect(doc.difficulty).toBe('hard');
        }
    }, 30000);

    /**
     * The budget has to be finite, and this is why: a 4×4 sudoku falls to singles however it is dug,
     * so hard there is unreachable and 25 draws in a row measured easy. What matters is that the room
     * still gets a puzzle and the console says so, rather than a worker spinning forever.
     */
    it('settles for the nearest band, and says so, when the difficulty cannot be reached', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const pool = openPool();

        const { doc, solution } = await pool.take({
            type: 'sudoku',
            difficulty: 'hard',
            size: square(4),
        });

        expect(doc.difficulty).toBe('easy');
        expect(solution).toHaveLength(16);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('puzzle.difficulty.settled'));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('sudoku:hard:4x4'));
    }, 30000);

    /**
     * KenKen takes its difficulty as an input to cage building rather than measuring it afterwards,
     * so it is already on the band by construction and the redraw is a check that never fires. Here
     * so that a future type which measures instead cannot quietly join it.
     */
    it('draws once for a type whose difficulty is a generation parameter', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const pool = openPool();

        const { doc } = await pool.take({ type: 'kenken', difficulty: 'hard', size: square(5) });

        expect(doc.difficulty).toBe('hard');
        expect(warn).not.toHaveBeenCalled();
    }, 30000);
});
