# ADR-0004: Hybrid puzzle supply: generate three types, bank the fourth

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §8](../design-spec.md#8-generation) · [architecture.md §5](../architecture.md#5-puzzle-module-boundary)

## Context

The platform needs an endless supply of sudoku, kenken, nonogram, and crossword. Three sourcing strategies were available: generate everything at runtime, pre-generate everything into a bank, or mix.

The four types are not alike in the way that matters. Sudoku, kenken, and nonogram are **constraint-satisfaction artifacts**: a generator can produce one from a seed and *prove* it has exactly one solution. Quality is a mathematical property, checkable by machine.

Crossword is **content**. The grid is trivial; the value is in the clues, which are wordplay written by a person. Automatic clue generation produces puzzles that are technically valid and joyless, and no amount of engineering fixes it, because the missing ingredient is authorship.

## Decision

**Generate sudoku, kenken, and nonogram at runtime. Serve crossword from a curated file bank. Put both behind one interface.**

- `server/puzzles/provider.js` exposes a single `getPuzzle({ type, difficulty, size, puzzleId })`.
- `GeneratorProvider` serves the three generated types from `pool.js`, which keeps pre-warmed puzzles per (type, difficulty, size), refilled in `node:worker_threads`.
- `BankProvider` serves crossword from `data/crosswords/`: a manifest plus one JSON file per puzzle, validated at boot.
- Every type implements the same module interface. Generated types write all four methods; a banked type writes three and has no `create`.
- Nothing past `getPuzzle()` knows which provider answered.

Generators reject any puzzle they cannot prove uniquely solvable. For nonogram that means a line-solver must resolve it, since ambiguous nonograms are the classic failure mode of naive generation.

## Consequences

**Good**

- Three of four types have infinite, free, instantly available content with machine-verified quality.
- Crossword gets human-quality clues, which is the only version worth shipping.
- The provider seam means a future source (a database, an API, user submissions) drops in without touching a call site.
- Pre-warmed pools keep generation off the event loop, which matters most when the host hits "new puzzle" and expects it instantly.
- Seeded generation makes puzzles reproducible, which makes generator bugs debuggable and tests deterministic.

**Bad**

- **Two content pipelines** with different failure modes: a generator bug versus a malformed bank file.
- Crossword variety is finite and grows only by human effort.
- **Licensing is a real blocker, split in two.** Shipping still requires hand-authored puzzles, public-domain sources, or permission; that half is open. Building is unblocked: freely-distributed `.puz` files are what the importer is developed against, which proves the format, loader, validator, and board without waiting on the answer.
- KenKen uniqueness verification is expensive and grows sharply with grid size. Measured in Phase 3: ~170ms median and 870ms worst at a 7×7 hard, absorbed by the pool. Sizes above 7 are not offered.

**The split is mechanical, not a promise.** The server reads two bank directories: `data/crosswords/`, tracked, holding only puzzles whose licence is known; and `data/crosswords-local/`, `.gitignore`d wholesale, where prototype imports land. `scripts/import-crossword.js` requires `--license` as an argument and never infers it from a copyright string. Building against copyrighted files stays possible and committing one stays impossible, which matters because that is the failure that cannot be undone. Freely downloadable is not freely redistributable, and a commit is a redistribution.

## Alternatives rejected

**Generate everything, including crosswords.** Filling a grid from a wordlist is a solved problem; writing clues is not. Auto-generated clues would make the crossword the worst thing in a product where it is likely the most-wanted type.

**Bank everything, generated offline by a build script.** Simplifies the runtime to a file read and removes worker threads. Rejected because it throws away unlimited, never-repeating content in exchange for a build pipeline and a finite library, and makes "same puzzle, different difficulty" a content problem rather than a parameter.

**Third-party puzzle APIs.** Adds a network dependency in the hot path, rate limits, an availability risk the app cannot control, and terms-of-service constraints. Generation is a few hundred lines and runs in a millisecond.

**Skip crossword entirely for v1.** Seriously considered, since it is the only type needing a content pipeline and the odd one out in every dimension. Kept because it is likely the most-wanted type, and deferring it to Phase 4 already isolates its risk.

## Revisions

| Change | Original | Why | When |
|---|---|---|---|
| Licensing split into "may we build" and "may we ship" | One open blocker on the whole phase | Freely-distributed `.puz` files answer the pipeline question without answering the content question | 2026-08-03 |
| Two bank directories, `--license` required by the importer | One bank directory, licence inferable from the source | The split needed a mechanism, not an intention: committing a copyrighted puzzle is the one unrecoverable failure | Phase 4, 2026-08-05 |
| A banked type's module has three methods | The interface was four methods for every type | `create` produces a puzzle and the other three rule on one; a banked type produces nothing | Phase 4, 2026-08-05 |
