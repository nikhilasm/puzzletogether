# ADR-0014: A clue cell carries two sums

**Status**: accepted · **Date**: 2026-08-30 · **Phase**: 5

## Context

Kakuro is the fifth puzzle type and the first whose structure is printed on the squares nobody
writes in. A clue square carries an across sum, a down sum, or both, split by a diagonal running from
the square's top-left corner to its bottom-right. Each sum sits on the side its run leaves by: the
across sum in the upper-right triangle, the down sum in the lower-left.

`DocCell` could not say that. It carries one `label`, a short string `<pt-cell>` draws in the
square's top-left corner, which is where a kenken cage clue goes and where a crossword entry number
goes. Two numbers in opposite corners of a square, divided by a rule, is not a label.

Three ways to close the gap were on the table.

Both alternatives were argued out before any code was written, which is why this record exists at
all: the decision looks small in the diff, and the two ways of losing it were not.

## Decision

**`DocCell` gains an optional `clue: { across, down }`, and `<pt-cell>` draws it.**

A clue square is `{ block: true, given: null, label: null, clue: { across: 23, down: 16 } }`. A
blocked square that starts no run carries `clue: null` and draws as the plain black square every
other type's blocks draw as. The field is optional, so the four existing types are untouched and no
document version moves.

Two consequences follow in `<pt-board>`, and neither is a hook:

- It passes `.clue` through to the cell, alongside `.label`.
- `#cellLabel()` no longer says `"blocked"` and stops when the square carries a clue. It reads the
  two field names the schema defines, and says `"clue 16 down, 23 across"`.

The second is the same shape of change as "a blocked square is never selected", which crossword
made: the base element being asked a question the document schema now allows, rather than being
taught what a kakuro is.

## Consequences

- A type can now print structure on a blocked square. Nothing else in the app has wanted that, and
  the field costs the types that do not want it one `null`.
- The phrasing lives in `<pt-board>` rather than behind a `spokenClue` hook. One implementation and
  no overrides is not an abstraction, and `spokenLabel` exists for the case where a subclass really
  does know something the base cannot.
- `<pt-cell>` grows a second full-size layer, drawn as a CSS gradient rather than a border, because
  the rule runs corner to corner and there is no diagonal border. It is a true diagonal only because
  a cell is square, which `aspect-ratio` on the host already guarantees.
- It is the first place in the app where type sits on an ink ground, so both sums are `--paper`. That
  is recorded in brand.md rather than left as a local decision.

## Alternatives rejected

**A `renderOverlay()` hook on `<pt-board>`, with the sums drawn from `meta`.** The clue layer would
be a positioned element inside the frame, like `<pt-presence-layer>`. It keeps `DocCell` untouched,
and it is the wrong trade twice over. It re-adds a hook Phase 4b deliberately removed, and it puts
the sums somewhere the cell cannot see, so the alignment between a clue and the square it is printed
on becomes something the overlay recomputes from the grid's geometry rather than something the DOM
guarantees. The 1px cell-alignment bug that reached a user in Phase 4 came from exactly that kind of
recomputation.

**Both sums packed into the existing `label`.** `{ label: '23\\16' }` needs no schema change and no
new hook, and it was tempting for about a minute. At a 13×13 on a phone the label is 7px in one
corner of a 23px square, and the two numbers have nothing to say which is which. The type's whole
structure would be the least legible thing on the grid.
