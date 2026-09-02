# ADR-0019: A region bounds its own alphabet

**Status**: accepted · **Date**: 2026-08-31 · **Phase**: 5

## Context

Suguru is the sixth puzzle type: a grid partitioned into irregular regions, each filled with the
digits 1..size-of-that-region exactly once, plus a rule no other type has, that identical digits
may not sit in orthogonally or diagonally adjacent cells anywhere on the grid. There is no
row/column constraint at all.

Every type built so far shares one assumption: `doc.meta.alphabet` is the puzzle's whole legal
digit set, and it is the same set for every cell. `validateOp` checks membership in it directly
(`doc.meta.alphabet.includes(op.value)`); the keypad sizes its keys from its length; the mark grid
lays out from it too. Suguru breaks the "same set for every cell" half of that. A 3-cell region
may only ever hold 1, 2, or 3; a 6-cell region elsewhere on the same grid may hold up to 6. Nothing
in the puzzle document currently says which digits a given cell may take beyond the puzzle-wide
maximum.

## Decision

**`meta.alphabet` keeps its existing meaning: the full display range, 1..the largest region in the
puzzle.** It is still what sizes the keypad and the mark grid, exactly as it does for sudoku and
kenken. A second, per-cell bound is derived, not stored: the size of the region a cell belongs to,
read off `meta.regions: [{ id, cells: [idx] }]`, the same shape kenken's cages already use minus
the arithmetic fields.

Neither side stores that bound on the cell. Both derive it once per document and cache it: the
server keeps a `WeakMap<doc, Uint8Array>` of region size by cell index, built the first time a
Suguru op is validated against a given doc; the client keeps the same array the way
`pt-kenken-board.js`'s `#cageOf` caches cage membership. `validateOp`'s `set` branch checks
`Number(op.value) <= sizeOf[op.cell]` alongside the existing length and digit checks;
`valueForKey` applies the same bound client-side, so a key past the selected cell's own region
size is a silent no-op rather than an optimistic write that bounces off the server.

## Consequences

- No change to `shared/schema.js` or `shared/protocol.js`. `DocCell` is untouched; `PuzzleDoc.meta`
  stays free-form per type, as it already is.
- `meta.alphabet` stops being a promise every cell in the puzzle accepts. Suguru is the first type
  where that is false. The doc comment on `PuzzleDoc.meta` in `protocol.js` should say so once this
  is built, the same way it already notes what sudoku's `meta` carries.
- A future type asking "what can this cell hold" now has two possible answers depending on
  whether meta.alphabet is uniform for its puzzle. Worth a one-line note wherever a puzzle module's
  header explains its own meta, the way kenken's and kakuro's already do.

## Alternatives rejected

**An explicit per-cell alphabet string on `DocCell`**, e.g. `cells[i].alphabet = '123'`. Rejected
because it is pure derivation of `meta.regions`, sent again on every cell for no new information.
Kakuro's `DocCell.clue` widened the schema for something genuinely new, two sums nothing else
could compute; a per-cell alphabet here would widen it for a lookup, which is a worse trade than
the one ADR-0014 made.

**Giving `meta.alphabet` a different meaning for Suguru alone**, per-cell rather than puzzle-wide,
and branching client code on `doc.type` to know which meaning applies. Rejected because it breaks
the one invariant every existing consumer of `meta.alphabet` relies on: the keypad's key count and
kenken's mark-grid sizing both read it as "the puzzle's display range," and a value whose meaning
depends on the type reading it is worse than two clearly named values.
