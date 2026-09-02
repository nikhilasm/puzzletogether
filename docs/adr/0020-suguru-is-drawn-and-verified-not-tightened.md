# ADR-0020: Suguru is drawn and verified, not tightened

**Status**: accepted · **Date**: 2026-08-31 · **Phase**: 5

## Context

KenKen's generator draws a full random Latin square first, partitions it into cages, and, when
the result is not uniquely solvable, repeatedly splits its largest cage and checks again. That
loop is sound because a cage's target is computed from whatever digits already sit inside it:
splitting a cage after the fact just recomputes two smaller targets from the same fixed solution,
so refinement never has to touch a placed digit.

Suguru cannot borrow that order. A region's size caps which digits are legal inside it: a 2-cell
region's two cells must be exactly `{1, 2}`, not any two different digits. A 5-cell region filled
from a solved grid of side 9 could hold a 7, which becomes illegal the moment that region is split
into something smaller. Partitioning a pre-filled grid, the way kenken does, can leave a split
region holding a digit its new, smaller domain does not allow. There is no order in which "solve
first, structure second" is safe here.

## Decision

**Partition and fill happen together, and a failed attempt is discarded, not repaired.** Draw a
region partition first, using the same flood-fill approach kenken's `buildCages` already performs
to grow regions to a target size distribution, minus the arithmetic-operator step. Fill that fixed
partition with a backtracking search whose domain per cell is 1..(its own region's size), pruned
at every placement by the adjacency rule, rather than borrowing digits from a pre-solved grid. A
partition the search cannot complete is treated exactly like an off-difficulty draw: worth nothing,
redrawn with a fresh seed rather than repaired ([ADR-0021](0021-a-region-needs-slack-not-just-room.md)
records why a partition can be unfillable before a value is even tried).

**The full grid is then dug like sudoku's, not shipped whole.** A completed grid with nothing dug
out of it has no given for anybody to read the puzzle from, and a suguru with no givens is
essentially never unique: nothing about the region and adjacency rules alone stops a whole region's
digits from being relabelled by some other permutation that still respects its neighbours. Holes
are removed one cell at a time, in shuffled order, keeping a removal only when a counting solver
still proves the grid uniquely solvable; this is sudoku's `digHoles` shape, not kenken's, since
kenken's cages carry no such thing as a given. Difficulty is measured by the puzzle's own technique
solver (region singles, adjacency elimination, region hidden singles, swept to a fixpoint) and a
dig that does not reach the requested rating stops at the nearest one, the same as sudoku's dig
loop. A draw that never reaches an acceptable rating is discarded and regenerated with a fresh seed:
the same shape as sudoku, nonogram, and kakuro, not kenken's in-place tightening.

No new pool mechanism is needed for this. The redraw budget `GeneratorPool` already runs for every
type whose generator measures difficulty rather than dialling it in ([ADR-0017](0017-the-pool-redraws-for-difficulty.md))
absorbs Suguru the same way it absorbs sudoku, nonogram, and kakuro today; Suguru is simply a new
`(type, difficulty, size)` key into a mechanism that already exists.

## Consequences

- Suguru's generator is closer in shape to sudoku's dig-from-a-full-grid generator than to
  kenken's, despite regions superficially resembling cages. `docs/design-spec.md` §8 records
  generation strategy per type for exactly this reason: two types can share a rendering approach
  and not share a generation one.
- The region-partitioning step (flood-fill to a size distribution) is now wanted by two types.
  Whether to extract it into a function `kenken/cages.js` and a Suguru module both call turned out
  not to be worth doing: the arithmetic-free partition kenken needs and the fillability-aware one
  Suguru needs ([ADR-0021](0021-a-region-needs-slack-not-just-room.md)) diverged enough during
  implementation that duplicating stayed the cheaper choice.
- Generation cost is now measured: `server/puzzles/suguru/suguru.test.js` times the offered range,
  5×5 through 9×9. Worst case sits under two seconds at a 9×9 hard, which the pre-warmed pool
  absorbs the same way it absorbs kenken's and kakuro's own worst cases.

## Alternatives rejected

**Reuse kenken's tighten-by-splitting loop, and re-fill only the two new regions a split
produces**, leaving the rest of the grid untouched. Rejected because a resplit region's neighbours
also constrain it under the adjacency rule, so a partial re-fill of just the split has to search
under the same constraints a full fill would, with none of kenken's actual saving, which is that
the rest of the grid provably never needs to be touched again.
