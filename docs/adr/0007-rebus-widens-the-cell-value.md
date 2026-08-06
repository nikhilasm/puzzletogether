# ADR-0007 — Rebus squares: widen the cell value, keep the type module the gate

- **Status**: Accepted
- **Date**: 2026-08-03
- **Context**: [design-spec.md §7](../design-spec.md#7-the-puzzle-abstraction) · [ADR-0004](0004-hybrid-puzzle-supply.md) · [ADR-0006](0006-jsdoc-checkjs-for-type-safety.md)

## Context

`shared/schema.js` has bounded every cell value at **exactly one character** since Phase 1, and the codebase has treated that as a load-bearing rule rather than an incidental limit. [design-spec.md §7](../design-spec.md#7-the-puzzle-abstraction) says nonogram's values are single characters "because `schema.js` bounds every cell value at one, and that rule holds for four types precisely because no type has been allowed to widen it." The nonogram module's own header repeats it. Three types have been designed around it deliberately.

Phase 4 brings real crosswords, and a **rebus** square — one square holding a whole word — is not an exotic corner of the format. It is a standard device in themed puzzles, and it is the theme: a grid where four squares each hold `HAND` is a puzzle *about* that, and importing it as four squares holding `H` is not a lesser version of the puzzle, it is a broken one. Of the four `.puz` files the importer is developed against ([ADR-0004](0004-hybrid-puzzle-supply.md)), one carries the `GRBS`/`RTBL` sections that encode exactly this.

Three ways out were available: refuse rebus puzzles at import, encode a rebus as a sentinel character with the real text held elsewhere, or widen the rule.

## Decision

**Widen the wire bound to 8 characters. The puzzle module's `validateOp` remains the only authority on what may go in a cell.**

- `shared/schema.js`'s `cellValue()` accepts 1–`MAX_CELL_VALUE_LENGTH` characters instead of exactly one. The constant lives in `shared/constants.js` beside the other limits.
- Nothing else in `shared/` changes. No new op type, no new field: a rebus keystroke emits an ordinary `set` carrying the **whole accumulated string**, so per-cell LWW, undo pre-images, and gap-recovery snapshots all keep working on a value that is simply longer.
- Every type's `validateOp` keeps deciding what its own cells accept. Crossword takes 1–8 characters from its alphabet; the other three take exactly one, as they always did.

**The schema's job is wire safety, not puzzle semantics.** That distinction was already how the file described itself — "Shape only — authority is a separate, later step" — and the length-1 rule was the one place it had quietly taken on a second job. Moving the bound puts the file back inside its own stated scope.

**One latent bug is fixed as part of this, because the widening is what makes it reachable.** Sudoku and kenken gate values with `doc.meta.alphabet.includes(op.value)`, which on a string is a **substring** test: `'123456789'.includes('12')` is `true`. Today no two-character value ever reaches it, because the schema rejects the op first — so the check has never been wrong in practice and the bug has never been visible. The moment the bound moves, that check is the only thing standing between a client and a sudoku cell containing `12`. It becomes a character-set test in the same change.

That is the shape of the risk this ADR accepts, stated plainly: the schema was enforcing a rule the type modules only *appeared* to enforce, and widening it converts three latent gaps into three real ones unless each is closed deliberately.

## Consequences

**Good**

- The doc format stops being the reason a legitimate puzzle cannot be served. Themed crosswords import intact.
- The op vocabulary is untouched. A rebus is not a new kind of edit — it is a `set` with a longer value, which means the reducer, the undo stack, the snapshot path, and every future puzzle type learn nothing new.
- "A cell holds one value" survives exactly as written. The cell still holds one value; the value is no longer one character. Nothing about LWW, marks-versus-value, or completion depends on its length.
- Check and completion already compare values with `===`. String equality is the same code and the same meaning at any length.

**Bad**

- **`shared/` changes in the phase whose premise is that a new type touches nothing shared.** Phase 3's result was that a type costs one server module and one client subclass; crossword costs those plus one constant and one bound. That is a real, if small, dent in the claim, and it is recorded rather than argued away.
- **The discipline moves from the schema to review.** Until now, a type physically could not accept a multi-character value. Now it can, and only its `validateOp` says otherwise. A fifth type that forgets to bound its values gets no error — it gets a bug. §7 gains this as a stated rule for adding a type.
- Cell rendering gains a size-to-fit rule with a floor, which is new geometry in the element whose per-update cost decides large-grid performance. It is computed from the value's length only, so it costs a property read.
- 8 is a judgement, not a derivation. It comfortably holds every rebus in ordinary use and keeps the wire bounded; a puzzle needing 9 will have to justify moving it.

## Alternatives rejected

**Refuse rebus puzzles at import.** The cheapest option, and it was the starting position — §7 has said "rebus deferred" since Phase 0. Rejected once the samples were actually inspected: it drops one of the four files outright, and behind that one file is a whole standard class of published crosswords. Declining a rule's *purpose* (bounding what crosses the wire) in order to preserve its *number* (one) is the wrong trade.

**A sentinel character, with the real text in `meta`.** Keeps the length-1 rule nominally intact: the cell holds `1`, and `meta.rebus[idx]` holds `HAND`. Rejected because the cell's value would then live in two places. `checkCells` has to dereference before comparing, undo pre-images stop being self-describing, and the board has to consult a side table to draw a square. Every cost of widening, none of the clarity, plus a permanent invitation for the two halves to disagree.

**A dedicated `rebus` op type.** Carries identical information to a longer `set` and adds a fourth op for the reducer, the schema, the undo stack, and every future type to handle. The op vocabulary is small on purpose.

**Let the player type freely and truncate on the server.** Silently discards input, which is the worst version of a limit — the grid would show something the player did not type and could not correct.
