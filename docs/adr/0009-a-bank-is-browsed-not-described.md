# ADR-0009 — A bank is browsed, not described

- **Status**: Accepted
- **Date**: 2026-08-06
- **Context**: [design-spec.md §4](../design-spec.md#puzzle-select) · [ADR-0004](0004-two-ways-to-supply-a-puzzle.md) · reverses part of a Phase 1 decision

## Context

Puzzle Select has asked the same three questions since Phase 1: what type, what size, how hard. That
is the right interface for a **generator**, and it is the right interface for exactly the reason
generators exist — there is no list of sudokus to choose from, so the host describes the one they
want and the generator makes it.

ADR-0004 added a second kind of supply without changing the question. A bank was made to answer the
same three fields, and Phase 4 shipped that: `bankCatalog()` published the sizes and difficulties its
files happened to carry, the host picked "5×5, easy", and `takeFromBank` chose at random among the
puzzles that matched.

It works, and it is wrong, and the playtest made that obvious the moment there was more than one
crossword behind the button. A banked puzzle **has a title, an author, and a publication**. Two 15×15s
of the same difficulty are not interchangeable the way two sudokus of the same difficulty are — they
are different pieces of writing by different people. Asking a host to describe one is asking them to
guess at a list they could simply be shown, and then serving them a random member of the set they
described.

## Decision

**A type whose provider has a list publishes that list, and the picker shows it.**

- `bankCatalog()` gains `puzzles`: one entry per puzzle carrying `id`, `title`, `author`, `source`,
  `size`, and `difficulty`. It travels on the join ack with the rest of the catalog.
- `<pt-puzzle-picker>` takes **two shapes, and which one follows the provider rather than the puzzle
  type**. A catalog entry with a `puzzles` array renders a scrolling list of cards; one without
  renders the size and difficulty rows exactly as before.
- `game:start` gains an optional **`puzzleId`**. When it names a puzzle the bank holds, that puzzle is
  served — ahead of the room's `served` set, because a host who pressed a title means that title even
  if the room has played it.
- The card still carries `size` and `difficulty` into the spec alongside the id. Those are what the
  *room* records in its settings and what "start another" falls back to, and that has to keep working
  identically whether a puzzle came from a bank or a generator.
- A named id that no longer exists **falls back to the description** rather than failing. It means a
  client holding a catalog older than the bank, which is a restart, not a mistake.

## Consequences

**Good**

- The host chooses a crossword the way anybody chooses a crossword: by looking at what there is.
- Difficulty stops being asked twice. A banked puzzle's difficulty is a fact about that puzzle, so
  the card states it and the question disappears rather than being answered redundantly.
- Size stops being a filter and becomes a column, which is more honest — a bank of four minis was
  offering a size picker with one button in it.
- The provider seam holds again, in the same way it did in Phase 4. `getPuzzle` grew one optional
  field; nothing that asks for a puzzle learned what a bank is.

**Bad**

- **The catalog now grows with the bank.** Four minis is nothing; a thousand crosswords with titles
  and authors is a payload on every join, sent to every player including the ones who cannot start
  anything. There is no pagination and no search, and at some size there will have to be.
- Two picker shapes is more UI than one, and the seam between them is a property test — `puzzles`
  present or absent — which is the kind of implicit contract that rots if a third provider kind ever
  appears.
- A host can now pick a puzzle the room has already solved, deliberately. That is the right answer to
  an explicit press, but it does mean `served` no longer guarantees what it used to.
- The room's settings still record only size and difficulty, so "start another" after a banked puzzle
  re-opens the list rather than offering the same puzzle again. That is wanted, but it means the
  spec that starts a puzzle and the spec a room remembers are no longer the same object.

## Alternatives rejected

**Keep the three questions and let the bank choose.** What shipped in Phase 4. It treats a crossword
as a specimen of a class, which is exactly what a crossword is not.

**Show the list but keep size and difficulty as filters above it.** Sound at a thousand puzzles and
pure clutter at four, and it would have to be built now to be built at all. The list is the thing
that has to exist; filtering it is a real feature to add when there is enough content to need it, and
adding it later costs nothing that adding it now saves.

**Give every type a list, generating a few sudokus up front to populate it.** Makes the interface
uniform by making the generator worse — it would have to produce puzzles nobody asked for, hold them,
and then throw most away, so that the picker could pretend a sudoku has an identity. The two supplies
are genuinely different and the interface should say so.

**Put `puzzleId` in the room's settings.** Would make "start another" offer the same crossword again,
which is not what anybody means by another.
