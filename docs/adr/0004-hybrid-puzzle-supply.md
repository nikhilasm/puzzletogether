# ADR-0004 — Hybrid puzzle supply: generate three types, bank the fourth

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §8](../design-spec.md#8-generation) · [architecture.md §5](../architecture.md#5-puzzle-module-boundary)

## Context

The platform needs an endless supply of sudoku, kenken, nonogram, and crossword puzzles. Three sourcing strategies were available: generate everything at runtime, pre-generate everything into a bank, or mix.

The four types are not alike in a way that matters enormously here.

Sudoku, kenken, and nonogram are **pure constraint-satisfaction artifacts**. A generator can produce one from a seed and *prove* it has exactly one solution. Quality is a mathematical property, fully checkable by machine.

Crossword is **content**. The grid is trivial; the value is in the clues, which are wordplay written by a person. Automatic clue generation produces puzzles that are technically valid and joyless — "a domesticated feline" instead of anything worth solving. No amount of engineering fixes this, because the missing ingredient is authorship.

## Decision

**Generate sudoku, kenken, and nonogram at runtime. Serve crossword from a curated file bank. Put both behind one interface.**

- `server/puzzles/provider.js` exposes a single `getPuzzle({ type, difficulty, size })`.
- `GeneratorProvider` serves the three generated types from `pool.js`, which keeps pre-warmed puzzles per (type, difficulty, size), refilled in `node:worker_threads`.
- `BankProvider` serves crossword from `data/crosswords/`, a manifest plus one JSON file per puzzle, validated at boot.
- Every type — generated or banked — implements the same four-method module interface: `create`, `validateOp`, `isComplete`, `checkCells`.
- Nothing past `getPuzzle()` knows or cares which provider answered.

Generators reject any puzzle they cannot prove uniquely solvable. For nonogram this specifically means a line-solver must resolve it, since ambiguous nonograms are the classic failure mode of naive generation.

## Consequences

**Good**

- Three of four types have infinite, free, instantly available content with machine-verified quality.
- Crossword gets human-quality clues, which is the only version of a crossword worth shipping.
- The provider seam means a future source — a database, a third-party API, user-submitted puzzles — drops in without touching any call site.
- Pre-warmed pools keep generation off the event loop, which matters most when the host hits "new puzzle" from the congrats modal and expects it instantly.
- Seeded generation makes puzzles reproducible, which makes generator bugs debuggable and tests deterministic.

**Bad**

- **Two content pipelines to maintain** instead of one, with different failure modes: a generator bug versus a malformed bank file.
- Crossword variety is finite and grows only by human effort. The bank needs curation, and the app's crossword offering is as good as whoever fills it.
- **Licensing is a real, unresolved blocker.** Crossword puzzles are copyrighted works. Shipping requires hand-authored puzzles, explicitly public-domain sources, or permission. This must be settled before Phase 4 begins — it is the top item in the spec's risk list.
- KenKen uniqueness verification is expensive and grows sharply with grid size; sizes above ~7 may need a time budget and retry cap.

## Alternatives rejected

**Generate everything, including crosswords.** Filling a grid from a wordlist is a solved problem; writing clues is not. Auto-generated clues would make the crossword the worst thing in the product, and crossword is the type with the widest audience. Not worth it.

**Bank everything, generated offline by a build script.** Simplifies the runtime to a file read and removes worker threads entirely. Rejected because it throws away the main advantage of the three generatable types — genuinely unlimited, never-repeating content — in exchange for a build pipeline and a finite library. It also makes "same puzzle, different difficulty knob" a content problem rather than a parameter.

**Third-party puzzle APIs.** Removes the generation work but adds a network dependency in the hot path, rate limits, an availability risk the app cannot control, and terms-of-service constraints. Generation is a few hundred lines and runs in a millisecond; outsourcing it buys nothing.

**Skip crossword entirely for v1.** Seriously considered, since it is the only type needing a content pipeline, and it is the odd one out in every dimension — letters not digits, clue lists, direction toggling, no generator. Kept because it is likely the single most-wanted type, and deferring it to Phase 4 already isolates its risk from everything else.
