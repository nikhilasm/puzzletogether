/**
 * KenKen's two search problems: a random Latin square to build from, and a counting solver to prove
 * the result has exactly one answer, the expensive step at larger sizes (design-spec.md §8). Two
 * things keep it affordable: the search visits cells cage by cage so arithmetic constrains the next
 * choice, and every cage prunes on its partial state.
 */

/** Bitmask for a digit, used for the per-row and per-column occupancy sets. */
function bit(digit) {
    return 1 << digit;
}

/**
 * Builds a random n × n Latin square: the solved grid a KenKen is carved out of.
 *
 * @param {number} n - Grid side length.
 * @param {import('../rng.js').Rng} rng - Seeded generator.
 * @returns {Uint8Array} n * n digits in row-major order, each row and column a permutation.
 */
export function randomLatinSquare(n, rng) {
    const cells = new Uint8Array(n * n);
    const rowMask = new Int32Array(n);
    const colMask = new Int32Array(n);

    const fill = (idx) => {
        if (idx === n * n) return true;

        const row = Math.floor(idx / n);
        const col = idx % n;
        const digits = rng.shuffle(Array.from({ length: n }, (_unused, i) => i + 1));

        for (const digit of digits) {
            const mask = bit(digit);
            if ((rowMask[row] & mask) !== 0 || (colMask[col] & mask) !== 0) continue;

            rowMask[row] |= mask;
            colMask[col] |= mask;
            cells[idx] = digit;
            if (fill(idx + 1)) return true;
            rowMask[row] &= ~mask;
            colMask[col] &= ~mask;
        }

        cells[idx] = 0;
        return false;
    };

    fill(0);
    return cells;
}

/**
 * Whether a cage can still reach its target given what has been placed in it so far.
 *
 * Called after every placement, including the ones that complete the cage: with no cells left the
 * bounds collapse to the exact arithmetic check, so the two cases are the same expression.
 *
 * @param {{ op: string, target: number, cells: number[] }} cage - The cage being checked.
 * @param {number} filled - How many of its cells now hold a digit.
 * @param {number} sum - Running sum of those digits.
 * @param {number} product - Running product of those digits.
 * @param {number} first - The first digit placed in this cage.
 * @param {number} latest - The digit just placed.
 * @param {number} n - Grid side, and so the largest digit available.
 * @returns {boolean} False when this branch can be abandoned.
 */
function cageHolds(cage, filled, sum, product, first, latest, n) {
    const remaining = cage.cells.length - filled;
    const { op, target } = cage;

    if (op === '=') return sum === target;

    if (op === '+') {
        if (remaining === 0) return sum === target;
        // Every remaining cell contributes at least 1 and at most n.
        return sum + remaining <= target && sum + remaining * n >= target;
    }

    if (op === '*') {
        if (remaining === 0) return product === target;
        return target % product === 0 && product * n ** remaining >= target;
    }

    // Subtraction and division are two-cell cages, so there is exactly one partner to account for.
    if (remaining === 0) {
        return op === '-'
            ? Math.abs(first - latest) === target
            : first === latest * target || latest === first * target;
    }
    return op === '-'
        ? first - target >= 1 || first + target <= n
        : first % target === 0 || first * target <= n;
}

/**
 * Counts the solutions a cage set admits, stopping as soon as limit are found.
 *
 * Generation only ever asks "is this exactly one?", so the search aborts at two rather than
 * enumerating a space that can be enormous for an under-constrained partition.
 *
 * @param {{ op: string, target: number, cells: number[] }[]} cages - The puzzle's cages.
 * @param {number} n - Grid side length.
 * @param {number} [limit] - Stop counting once this many solutions are found.
 * @returns {number} The number of solutions found, capped at limit.
 */
export function countSolutions(cages, n, limit = 2) {
    const order = [];
    const cageAt = [];
    for (const [cageIdx, cage] of cages.entries()) {
        for (const cell of cage.cells) {
            order.push(cell);
            cageAt.push(cageIdx);
        }
    }

    const rowMask = new Int32Array(n);
    const colMask = new Int32Array(n);
    const filled = new Int32Array(cages.length);
    const sum = new Int32Array(cages.length);
    const first = new Int32Array(cages.length);
    const product = new Float64Array(cages.length).fill(1);

    let found = 0;

    // Returns true to unwind the whole search, which happens only once limit is reached.
    const place = (step) => {
        if (step === order.length) {
            found += 1;
            return found >= limit;
        }

        const idx = order[step];
        const row = Math.floor(idx / n);
        const col = idx % n;
        const cageIdx = cageAt[step];
        const cage = cages[cageIdx];

        for (let digit = 1; digit <= n; digit += 1) {
            const mask = bit(digit);
            if ((rowMask[row] & mask) !== 0 || (colMask[col] & mask) !== 0) continue;

            if (filled[cageIdx] === 0) first[cageIdx] = digit;
            filled[cageIdx] += 1;
            sum[cageIdx] += digit;
            product[cageIdx] *= digit;

            const viable = cageHolds(
                cage,
                filled[cageIdx],
                sum[cageIdx],
                product[cageIdx],
                first[cageIdx],
                digit,
                n,
            );

            if (viable) {
                rowMask[row] |= mask;
                colMask[col] |= mask;
                if (place(step + 1)) return true;
                rowMask[row] &= ~mask;
                colMask[col] &= ~mask;
            }

            product[cageIdx] /= digit;
            sum[cageIdx] -= digit;
            filled[cageIdx] -= 1;
        }

        return false;
    };

    place(0);
    return found;
}
