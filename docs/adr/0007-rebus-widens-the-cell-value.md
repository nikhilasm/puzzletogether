# ADR-0007: Rebus squares: widen the cell value, keep the type module the gate

- **Status**: Accepted
- **Date**: 2026-08-03
- **Context**: [design-spec.md §7](../design-spec.md#7-the-puzzle-abstraction) · [ADR-0004](0004-hybrid-puzzle-supply.md) · [ADR-0006](0006-jsdoc-checkjs-for-type-safety.md)

## Context

`shared/schema.js` bounded every cell value at **exactly one character** from Phase 1, and the codebase treated that as load-bearing rather than incidental. Three types were designed around it deliberately.

Phase 4 brings real crosswords, and a **rebus** square, one square holding a whole word, is not an exotic corner of the format. It is a standard device in themed puzzles, and often it *is* the theme: a grid where four squares each hold `HAND` is a puzzle about that, and importing it as four squares holding `H` is not a lesser version of the puzzle, it is a broken one. One of the four `.puz` files the importer is developed against carries the `GRBS`/`RTBL` sections that encode exactly this.

Three ways out: refuse rebus puzzles at import, encode a rebus as a sentinel with the real text held elsewhere, or widen the rule.

## Decision

**Widen the wire bound to 8 characters. The puzzle module's `validateOp` remains the only authority on what may go in a cell.**

- `cellValue()` accepts 1–`MAX_CELL_VALUE_LENGTH` characters instead of exactly one. The constant lives in `shared/constants.js` beside the other limits.
- Nothing else in `shared/` changes. No new op type, no new field: a rebus keystroke emits an ordinary `set` carrying the whole accumulated string, so LWW, undo pre-images, and gap-recovery snapshots keep working on a value that is simply longer.
- Every type's `validateOp` decides what its own cells accept. Crossword takes 1–8 characters from its alphabet; the other three take exactly one.

**The schema's job is wire safety, not puzzle semantics.** The file already described itself that way; the length-1 rule was the one place it had quietly taken on a second job.

**One latent bug is fixed as part of this, because the widening is what makes it reachable.** Sudoku and kenken gated values with `doc.meta.alphabet.includes(op.value)`, which on a string is a **substring** test: `'123456789'.includes('12')` is `true`. No two-character value ever reached it, because the schema rejected the op first, so the check had never been wrong. The moment the bound moves, that check is the only thing between a client and a sudoku cell containing `12`. It becomes a character-set test in the same change.

That is the shape of the risk accepted here: the schema was enforcing a rule the type modules only appeared to enforce, and widening it converts three latent gaps into real ones unless each is closed deliberately.

## Consequences

**Good**

- The doc format stops being the reason a legitimate puzzle cannot be served. Themed crosswords import intact.
- The op vocabulary is untouched. A rebus is a `set` with a longer value, so the reducer, the undo stack, the snapshot path, and every future type learn nothing new.
- "A cell holds one value" survives as written. The value is no longer one character; nothing about LWW, marks-versus-value, or completion depends on its length.
- Check and completion already compare with `===`, which is the same code and meaning at any length.

**Bad**

- **`shared/` changes in the phase whose premise is that a new type touches nothing shared.** Crossword costs one server module, one client subclass, one constant, and one bound. A real if small dent in Phase 3's claim, recorded rather than argued away.
- **The discipline moves from the schema to review.** A type physically could not accept a multi-character value before; now only its `validateOp` says otherwise, and a fifth type that forgets gets a bug rather than an error.
- Cell rendering gains a size-to-fit rule with a floor, which is new geometry in the element whose per-update cost decides large-grid performance. It is computed from the value's length only.
- 8 is a judgement, not a derivation. It holds every rebus in ordinary use and keeps the wire bounded; a puzzle needing 9 will have to justify moving it.

## Alternatives rejected

**Refuse rebus puzzles at import.** The cheapest option and the starting position. Rejected once the samples were inspected: it drops one of four files outright, and behind that file is a whole standard class of published crosswords. Declining a rule's purpose (bounding what crosses the wire) to preserve its number (one) is the wrong trade.

**A sentinel character, with the real text in `meta`.** Keeps the length-1 rule nominally intact and puts the cell's value in two places. `checkCells` would dereference before comparing, undo pre-images stop being self-describing, and the board consults a side table to draw a square. Every cost of widening, none of the clarity.

**A dedicated `rebus` op type.** Carries identical information to a longer `set` and adds a fourth op for the reducer, the schema, the undo stack, and every future type.

**Let the player type freely and truncate on the server.** Silently discards input, so the grid would show something the player did not type and could not correct.
