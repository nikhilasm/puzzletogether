# ADR-0017: The pool redraws until the difficulty matches

**Status**: accepted · **Date**: 2026-08-30 · **Phase**: 5

## Context

Three of the four generated types **measure** the difficulty of the puzzle they made rather than
dialling it in. Sudoku rates a dug grid by the techniques it needs, nonogram and kakuro by how many
sweeps the rules take to settle it. Only kenken takes difficulty as an input, to cage building, and
records that departure openly (design-spec.md §8).

A generator that measures can therefore miss. Each already searches internally and hands back the
nearest band it managed, which is honest, and `getPuzzle` then served it. A host who asked for hard
got a puzzle labelled with what it turned out to be, and nothing anywhere tried again.

Measured over twelve draws per type, size and difficulty, the miss was not rare:

| | draws on the band asked for |
|---|---|
| kakuro 7×7 hard | 7 of 12 |
| kakuro 11×11 and 13×13, medium and hard | 11 of 12 |
| sudoku 6×6 hard | 9 of 12 |
| sudoku 6×6 medium | 0 of 12 |
| sudoku 4×4 medium and hard | 0 of 12 |
| kenken and nonogram, every size | 12 of 12 |

Two different faults are in that table. The kakuro and 6×6-hard rows are **luck**: the band is
reachable and the draw fell the other way. The sudoku rows below 9×9 are **not**. A 4×4 or 6×6 falls
to naked and hidden singles however it is dug, so there is no such thing as a hard 4×4 sudoku;
`DIFFICULTY_MIN_SIDE.sudoku = 9` has recorded that since Phase 1.

## Decision

**The pool redraws.** `GeneratorPool` takes up to `DIFFICULTY_ATTEMPTS` independent draws, returning
the first whose measured difficulty is the one asked for.

**The pool rather than the generators**, because a redraw's whole contribution is a fresh seed. A
generator's internal loop reuses one rng stream and one set of tuned parameters; the same
specification drawn again from a new seed is an independent puzzle. It also puts one piece of code
across all four types, so a future generated type inherits the guarantee instead of having to
remember it, and it leaves `generateInline` a single deterministic draw from a seed, which is what
the tests want.

**The bank is untouched.** For a banked crossword, difficulty is a stated preference and `bank.js`
says so: size is honoured exactly, difficulty falls back, because a finite bank may hold no hard
15×15 and serving a medium one beats serving nothing (ADR-0004).

**The budget is finite, and then the pool settles for the nearest band and warns.** Retrying forever
is what the unreachable rows above rule out: a request for a hard 4×4 would pin a worker thread on a
search with no answer, and the room asking would wait on it. Generation stays total, so an
unsatisfiable request costs a room a puzzle rated one band away, which is exactly what it already
got, rather than no puzzle at all. Ten draws is enough that every reachable band comes back exact,
and it is cheap where it is spent in full, since the unreachable cases are all small sudoku at about
3ms a draw.

**Puzzle Select stops emitting the request that cannot be met.** The picker already disabled the
difficulty buttons below a type's floor and said the grids are always easy, but the spec it
submitted kept whatever had been chosen higher up: pick hard at 9×9, drop to 4×4, and it showed
nothing selected while still submitting hard, with no enabled button to take it back. `#choose` now
drops the difficulty to the first band whenever the size is under the floor. This is the same rule
the banked card list already obeys, that what the picker submits is what it is showing.

## Consequences

- **Every request the app can make now comes back on the band asked for.** Over 720 takes across
  every type, size and difficulty, 679 were exact and all 41 misses were sudoku below its own 9×9
  floor, which the picker no longer lets a host ask for. Kakuro at 7×7 hard went from 7 in 12 to 16
  in 16.
- **Difficulty is a promise for generated types and a preference for banked ones.** That split was
  already true and undocumented; it is now the visible reason the bank does not redraw.
- **Generation costs more where it used to miss**, and only there. Draws per take are 1.1 to 1.5
  across the kakuro rows, 2.3 at 7×7 hard. A 13×13 hard kakuro averages 434ms against 173ms, worst
  case 1.3s. It is spent in a worker against a pre-warmed pool, so it is CPU and not latency, except
  on the first take of a cold specification.
- **An unreachable request is now visible.** It was silent before: the wrong rating went out and
  nothing said so. It logs `[pool] sudoku:hard:4x4: nothing on that band in 10 draws, serving easy`
  once per generation.
- **A new generated type inherits the guarantee**, since the redraw sits above the module seam and
  reads `doc.difficulty`. What it must get right is that `doc.difficulty` is the measured rating.
  A type that copied kenken and reported the requested value back would pass this check trivially
  and always, which is a way to be wrong that nothing detects.

## Alternatives rejected

**Retry without a bound**, which is the literal request. A difficulty can be unreachable at a size
rather than merely rare, and this turns that case from a mislabelled puzzle into a hung room and a
pinned worker thread.

**Reject the request instead of settling.** Honest, and it makes an unreachable combination
impossible to ignore. Rejected because the failure lands on the room rather than on whoever
configured the sizes: a host asking for hard 4×4 sudoku would get an error and no puzzle, where the
same host previously got a playable grid. It also needs matching handling at the socket boundary and
in the picker to be anything other than a dead end.

**Raise each generator's own attempt budget instead.** Cheaper to write, and it does not work as
well: those loops redraw within one seeded stream and one set of tuned parameters, which is why
sudoku's already generous internal budget still returned easy 12 times in 12 at 4×4. It would also
be four separate pieces of code doing the same thing, and a fifth to write for the next type.
