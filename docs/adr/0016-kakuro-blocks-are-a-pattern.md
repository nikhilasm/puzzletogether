# ADR-0016: Kakuro blocks are a pattern, not a scatter

**Status**: accepted · **Date**: 2026-08-30 · **Phase**: 5

## Context

Generation drew its blocks by subdividing: open the whole interior, then cut whichever run was still
too long, one square at a time, keeping any cut that left no run of one. The grids came out uniquely
solvable, fast, and with runs of a real length, which is what [ADR-0015](0015-kakuro-clues-are-chosen-not-derived.md)
was for. They did not look like kakuro.

The obvious reading is that they were too empty, and the obvious reading is wrong. Measured over
eight grids per size and difficulty, the interior was 17 to 30 per cent blocked, which is what a
printed kakuro carries. What it was not was arranged:

- **Symmetry, measured as the share of interior squares agreeing with their 180° partner: 71 per
  cent.** Two coin flips at that density agree 69 per cent of the time. The pattern was as symmetric
  as chance and no more.
- **Blocks landed as scattered singles**, because they were placed one at a time wherever a run
  happened to be too long, so nothing ever drew two of them together.

A grid whose black squares carry no pattern reads as damage rather than as design, whatever its
density. That is the whole of the complaint, and it is a property of where the blocks are, not how
many there are.

## Decision

**The layout is drawn as a pattern, in `server/puzzles/kakuro/layout.js`.** Three rules, and only
the second costs the puzzle anything:

1. **Blocks are placed in symmetric pairs.** Free: it says where a block goes, not how many there
   are.
2. **A density target per difficulty**, `{ easy: 0.30, medium: 0.24, hard: 0.20 }` of the interior.
3. **A preference for placing beside a block already down**, three placements in four, which is what
   turns a scatter into clumps and thick corners.

A pair is refused if it leaves a run of one square or **disconnects the open squares**. That last
check is new and is needed because of symmetry: one block rarely walls a grid off, a mirrored pair at
a quarter density does it readily, and a walled-off region is a second puzzle sharing the page,
separately clued and separately ambiguous. Nothing else catches it, since two disconnected halves are
perfectly consistent with each other, so the solver calls such a grid settled and fair.

**The symmetry is of the interior, not of the grid.** A kakuro's clue border is the top row and left
column only, so turning the whole grid 180° would map that border onto the last row and column,
where a kakuro has squares a player fills. Interior squares are rows and columns 1 to n-1, and that
region does map onto itself. Every offered side is odd, so the interior side is even, its centre
falls between squares, and no square is ever its own partner: placement is always a pair and a block
count is always even.

That the border is never a candidate is also what keeps `clueSquare` in range. It subtracts 1 or n
with no bounds check, on the promise that no run starts against the grid's edge, and the layout keeps
that promise by construction rather than by a guard.

**The per-difficulty run ceiling is retired to a single `RUN_LIMIT = 8`.** It was
`{ easy: 7, medium: 8, hard: 8 }`, and after the grid's own width clamped it the three levels
evaluated to the same run length at every offered size except 13×13. Density replaces it as the
layout half of difficulty and separates at all four.

Two smaller consequences follow. Repair's last resort, blocking an unsettled square, **offers the
symmetric pair first** and falls back to the single square, so the pattern survives the repair. And
the fallback ladder, which used to shorten runs when nothing settled, now raises density instead:
the same trade said in the new units.

## Consequences

- **The grids are patterned.** Across 240 puzzles at every size and difficulty, 203 came out exactly
  symmetric and the worst carried six unmirrored squares out of an interior of up to 144. Blocks sit
  2.4 to 2.7 to a clump against the 1.7 a scatter gives at the same density.
- **Density is now a difficulty knob that works at every size**, 31 to 33 per cent for easy against
  21 to 26 for hard, where the run ceiling it replaces was doing nothing below 13×13.
- **Runs are shorter, and this is the price.** Every block shortens two runs, so the two aesthetics
  are one dial: a medium 13×13 averages 3.5 squares where it averaged 4.0. It is the right way round
  to spend it, since a run of three in a patterned grid still reads as kakuro and a run of four in a
  noise field does not, but it is a real cost and not a free lunch.
- **The run-length guard in the tests fell from 3.4 to 3.1.** Pooled over thirty seeds a medium 13×13
  now averages 3.4 with individual grids from 2.6 to 3.9, so the old floor would have been measuring
  which seeds the test named rather than what the generator does. It still fails loudly at the 2.5
  the fill-first generator produced, which is what it is for.
- **Generation got faster**, because a denser grid is an easier one to settle: a hard 13×13 fell from
  1052ms to 197ms on average, worst case 412ms against 2.0s.
- **No printed digits, and the difficulty hit rate holds**, 177 of 192 exact against 114 of 120
  before. The one weak cell is 7×7 hard at about half, which this change did not move: on the seeds
  measured before and after it produced the identical ratings. A 6×6 interior with runs capped at
  four has little room to be hard.
- **Clustering is a preference and is not tested.** Symmetry, connectivity, and the border are laws
  and have assertions. Blocks per clump separates from a scatter by about 1.5x with overlapping
  per-puzzle ranges, so any threshold would measure the seed rather than the rule.

## Alternatives rejected

**Rotational symmetry of the whole grid**, as a crossword has. Impossible for this type, not merely
undesirable: the clue border is top and left, and its 180° image is the bottom row and right column,
which a kakuro fills.

**Reflection about the main diagonal.** This one the grid genuinely admits, since transposing maps
the border onto itself. Rejected because it makes every across run the mirror of a down run, so the
two directions stop being independent and the puzzle reads as one half solved twice.

**Biasing placement toward the first interior row and column**, to step the clue border inward. It
already happens without asking, twice per grid at 13×13, and `clueSquare` already follows it. Pushed
harder it costs twice over: under the symmetry a step at the top pairs with a block eating the last
row, and every step also empties a border square, so a heavily stepped border is a long stretch of
featureless black. Border steps are better as something clustering produces than as something asked
for.
