# ADR-0021: A region needs slack, not just room

**Status**: accepted · **Date**: 2026-08-31 · **Phase**: 5

## Context

The original design allowed 1- and 2-cell regions deliberately, against the recommendation to floor
at 3, on the reasoning that a 1-cell region costs a solver almost nothing and a puzzle can afford a
few. Building the generator found a fact that reasoning did not account for: suguru's adjacency rule
makes region size a **fillability** constraint, not only a difficulty one.

Every cell touches up to eight others, orthogonally or diagonally, so any 2×2 block on the grid is a
clique of four mutually-adjacent cells and always needs four pairwise-distinct values. A region of
size k gives its own cells a domain of only 1..k. Because every domain here is a range starting at
1, Hall's marriage theorem for the block collapses to a sorted comparison: sort the four cells'
region sizes ascending, a system of distinct representatives exists iff the i-th smallest is at
least i. A grid built entirely from size-3 regions fails this for every single 2×2 block on the
board, since no cell anywhere can ever hold a 4: not a hard fill, an impossible one, proven before a
single value is tried and true of any redraw whatsoever.

Measurement went further than the 2×2 proof. A distribution of size-4 regions passes that local
check with zero slack, and passing with zero slack turned out to be nearly as bad as failing it: of
800 randomly grown size-4 partitions at 6×6, none were fillable. Size 5 filled about 1 in 5. Size 6,
which gives a 2×2 block two full digits of slack over what it strictly needs, filled 3 to 4 times in
5. A second design, an interleaved search that grows a region's shape and assigns its values
together and backtracks across both, recovered some ability to use size-3 regions at small grids
(6×6 found valid partitions 6 to 11 times in 15) but degraded sharply as the grid grew and was
already too slow to ship by 8×8, without a materially larger investment in real constraint
propagation the small-region goal did not seem to justify on its own.

## Decision

**Region size is a fillability budget the generator spends, and it spends more of it at easy than
at hard.** `easy` draws from `[5, 5, 6]`, sizes measured to fill reliably; `hard` draws from
`[3, 4, 4, 5]`, leaning on the sizes that ask more of the fill search and, not incidentally, more of
a solver too. This inverts kenken's cage-size intuition, where a harder puzzle earns bigger,
looser-feeling groups: here a harder suguru is smaller, more varied regions, because size is not
free to assign by feel once it is also what makes a partition constructible at all. A 1- or 2-cell
region can still happen, capped by `SMALL_REGION_ALLOWANCE` the way kenken caps single-cell cages,
but it is never drawn on purpose.

**A partition the fill search cannot complete is caught and the whole attempt is redrawn**, region
partition included, the same as an off-difficulty result (ADR-0020). This is cheap: a partition the
search gives up on fails in well under a millisecond at the sizes offered, so the generator's outer
loop was widened to 2000 attempts, governed in practice by its wall-clock budget rather than by that
count.

**The search itself is bounded by a node budget.** An early version had no such cap and one draw ran
for over three minutes before returning, because proving no solution exists (or that a partial grid
has only one) means exhausting a branch, and a loosely-constrained partition can make that branch
enormous. `solver.js` now caps a single search at 100,000 nodes, the same shape as kakuro's own
`NODE_BUDGET`, so the generator's outer time budget is what actually governs a slow run rather than
one inner call refusing to return; a cut search is never mistaken for a proof of uniqueness.

## Consequences

- `docs/design-spec.md` §8's suguru paragraph, and the region-size framing in its §7 prose, describe
  size as inverted with difficulty for this reason; a reader expecting kenken's direction should
  find the explanation here rather than have to re-derive it.
- Difficulty is still carried entirely by the dig, exactly as ADR-0020 already decided; region size
  moved once implementation started, but only as a fillability lever, and the measured-not-requested
  rating never changed.
- Suguru's offered sizes are `5, 6, 7, 8, 9` and every difficulty is reachable at every one of them
  (`DIFFICULTY_MIN_SIDE.suguru = 0`), measured in `suguru.test.js`'s timing case: worst case is under
  two seconds at a 9×9 hard, the size and difficulty that spends region size most aggressively.

## Alternatives rejected

**An interleaved constructive search**, growing a region's shape and its cells' values together in
one backtracking pass, backtracking across the region decision itself when a cell paints itself into
a corner. Built and measured before this decision: it genuinely could place 3-cell regions where the
blind two-phase approach could not, but success collapsed above 6×6 (0 of 15 at 7×7 easy, 0 of 15 at
8×8 across every difficulty tried) and even its successes cost 300ms to 1.7s. Getting it to scale to
9×9 needed real forward-checking and an MRV cell order, a materially bigger and still open-ended
piece of work weighed against a two-phase approach already measured reliable once its size pools
respected the fillability finding above.

**One region-size floor for every difficulty**, at 3 cells and up. Rejected once measurement showed
3 is not merely a hard floor but a mathematical impossibility at any offered size, and 4 fills too
rarely to be a pool's only or dominant size; a single distribution cannot serve every difficulty
reliably when the sizes that make a partition constructible and the sizes a designer might reach for
by feel are not the same sizes.
