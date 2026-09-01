# ADR-0015: Kakuro clues are chosen, not derived from a filled grid

**Status**: accepted · **Date**: 2026-08-30 · **Phase**: 5

## Context

The first kakuro generator worked the way the other three generated types do: make an answer, then
describe it. Fill every open square with digits, add up each run, and print the totals as clues. Both
sudoku and kenken start from a solved grid, so it was the obvious shape.

For kakuro it produces bad puzzles, and the reason is structural rather than a matter of tuning.

A random filling gives runs middling sums, and a middling sum says almost nothing: 20 across four
squares is fourteen different digit sets. The clues therefore fail to pin the grid, and the sums are
a flow constraint over a graph whose vertices are runs and whose edges are squares, so every cycle in
that graph is a degree of freedom the clues cannot see. Measured, not one drawn grid at 9×9 or larger
had a single answer.

Everything after that was compensation. Ambiguity was repaired by blocking squares and printing
digits, which works, and each repair shortens runs. The puzzles that came out had runs averaging 2.5
squares against the 4 or more a real kakuro has, and carried up to 7 printed digits, which kakuro
conventionally has none of. A run of two squares is a pair of digits with a total; a grid of them is
arithmetic, not a puzzle.

## Decision

**Choose the clue values directly, each for how much of the board it settles.** Nothing is filled in
first. A solver narrows what every square can hold, and generation is a search over clue values with
that narrowing as its score:

1. **Lay the blocks out by subdivision**, splitting runs that exceed a per-difficulty ceiling, so run
   length is something asked for rather than something left over.
2. **Seed the crossings.** Where neither clue through a square is chosen, take a pair that pins it
   hard: 26 in three squares is `{6,8,9}`, 21 in six is `{1..6}`, so a square in both is a 6 before
   anything else is known. Precomputed per pair of run lengths.
3. **Choose the rest, loosest clue first**, each taking a value weighed by what the whole board looks
   like afterwards. The clue with the most values still open carries the most uncertainty, so it is
   the one worth deciding.
4. **Repair what is left** by re-choosing the two clues crossing an unsettled square, and only if
   that fails by blocking the square out of the grid.

Two things make it affordable. A run is analysed **exactly** rather than approximately: its legal
fillings form a small graph, and a forward and backward pass over it say precisely which digits each
square can hold and which sums the clue could still take. And narrowing runs from a **worklist**, so
choosing one clue only re-examines the runs that could have learned something.

Two global facts prune it. The across clues and the down clues both total every digit in the grid, so
a value that puts those two totals out of reach is refused before it is weighed. And a settled board
is a unique board, because narrowing is sound: two answers would leave a square holding two digits.

The approach is the one described publicly by another developer working on the same problem, adopted
here on their account of it. It departs from that description in two places:

- **Repair prefers re-choosing clues over blocking a square.** The original blackens first and
  re-chooses only when there were no black squares to add. Blocking costs the puzzle a square and
  shortens two runs, which is the thing this rebuild exists to avoid, so it is the second move here
  rather than the first.
- **Difficulty steers which value is taken.** The original always takes the most constraining value,
  which makes the tightest puzzle the layout can carry. Taking a looser one is what produces a harder
  puzzle at a size whose run ceiling is already capped by the grid's own width.

## Consequences

- Runs average 4.0 to 4.2 squares at 11×11 and 13×13, against 2.5 before, and open squares per
  puzzle rose from 24-86 to 26-118. A 13×13 is now a 13×13. **Since revised down to about 3.5 at
  medium**, deliberately: [ADR-0016](0016-kakuro-blocks-are-a-pattern.md) gave the layout a block
  density, and every block shortens two runs, so run length and the look of the grid turned out to be
  one dial.
- **No printed digits.** Zero across 120 generated puzzles at four sizes and three difficulties.
  Printing survives only as the last resort that keeps generation total, and nothing has reached it.
- **Difficulty is two knobs, not one.** Run length alone could not separate the levels, because the
  grid's width caps it and medium and hard share a ceiling at every offered size. How far down the
  ranking of candidate clue values each difficulty reaches is the second, and it works where run
  length cannot. 114 of 120 puzzles came back at the level requested.
- **`DIFFICULTY_MIN_SIDE.kakuro` falls from 9 to 0.** All three levels are now reachable at 7×7,
  which the old generator could not do.
- **Every generated puzzle is settled by the rules**, so none needs a guess. The `hard` band is now
  the top of a sweep count rather than "the rules do not finish it"; the unsettled case is kept
  because a hand-made puzzle could still arrive that way.
- Generation is slower: median 1 to 815ms, worst 2.0s at a 13×13, against a 1.4s worst before. It
  runs in a worker against a pre-warmed pool, so this is CPU rather than latency.
- The propagator is now load-bearing in a way it was not. Anything it cannot deduce has to be paid
  for with a shorter run or a printed digit, so weakening it silently makes worse puzzles rather than
  failing a test.

## Alternatives rejected

**Keep deriving sums from a filling, and bias the filling toward extreme sums.** Runs were given a
pull toward small or large digits so their totals would have few decompositions. It measurably
helped, taking 7×7 from 5 uniquely solvable draws in 12 to 7, and it did not touch the problem at
9×9 and above, where the count stayed at nought or one. A better guess at the answer does not fix a
method that never looks at the clues it is producing.

**Keep the fill-first generator and accept short runs.** It was fast, total, and shipped. It also
produced grids that a kakuro solver would not recognise, which is the whole of what a puzzle type has
to get right.
