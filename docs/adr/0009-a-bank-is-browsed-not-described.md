# ADR-0009: A bank is browsed, not described

- **Status**: Accepted, extended with filters 2026-08-07
- **Date**: 2026-08-06
- **Context**: [design-spec.md §4](../design-spec.md#puzzle-select) · [ADR-0004](0004-hybrid-puzzle-supply.md) · reverses part of a Phase 1 decision

## Context

Puzzle Select asked the same three questions from Phase 1: what type, what size, how hard. That is the right interface for a **generator**, and for the reason generators exist: there is no list of sudokus to choose from, so the host describes the one they want and the generator makes it.

ADR-0004 added a second kind of supply without changing the question. A bank was made to answer the same three fields: `bankCatalog()` published the sizes and difficulties its files happened to carry, the host picked "5×5, easy", and `takeFromBank` chose at random among the matches.

It works, and it is wrong, and the playtest made that obvious the moment there was more than one crossword behind the button. A banked puzzle **has a title, an author, and a publication**. Two 15×15s of the same difficulty are two pieces of writing by two people, not two specimens of a class the way two sudokus are. Asking a host to describe one is asking them to guess at a list they could be shown, and then serving a random member of the set they described.

## Decision

**A type whose provider has a list publishes that list, and the picker shows it.**

- `bankCatalog()` gains `puzzles`: one entry per puzzle carrying `id`, `title`, `author`, `source`, `size`, and `difficulty`. It travels on the join ack with the rest of the catalog.
- `<pt-puzzle-picker>` takes **two shapes, and which one follows the provider rather than the puzzle type.** A catalog entry with a `puzzles` array renders a scrolling list of cards; one without renders the size and difficulty rows as before.
- `game:start` gains an optional **`puzzleId`**. When it names a puzzle the bank holds, that puzzle is served ahead of the room's `served` set: a host who pressed a title means that title even if the room has played it.
- The card carries `size` and `difficulty` into the spec alongside the id. Those are what the *room* records in its settings and what "start another" falls back to, and that has to work identically whether a puzzle came from a bank or a generator.
- **The card states its difficulty.** With a filter narrowing on it, showing it is not cosmetic.
- A named id the bank no longer holds **falls back to the description** rather than failing. It means a client holding a catalog older than the bank, which is a restart, not a mistake.

**The list can be filtered**, on size and difficulty. Three rules keep the filters from becoming the interface again:

- **A filter row is drawn only where the bank has more than one value behind it.** On four 5×5 easy minis neither row appears.
- **An option that would empty the list is disabled, not hidden.** An option is pressable only if something is behind it given the other filter's value, so every reachable pair holds a card and Start can never point at a puzzle no longer on screen. Filtering the chosen card away moves the selection to the first still visible, and the picker announces it.
- **The count appears only while a filter is on**: `Choose a puzzle · 2 of 12`.

## Consequences

**Good**

- The host chooses a crossword the way anybody chooses a crossword: by looking at what there is.
- Difficulty stops being asked twice. It is a fact about the puzzle, so the card states it and the question disappears.
- Size stops being a filter and becomes a column, which is more honest: a bank of four minis was offering a size picker with one button in it.
- The provider seam holds. `getPuzzle` grew one optional field; nothing that asks for a puzzle learned what a bank is.

**Bad**

- **The catalog grows with the bank.** Four minis is nothing; a thousand crosswords with titles and authors is a payload on every join, sent to every player including those who cannot start anything. There is no pagination and no search, and at some size there will have to be. The filters do not help: they narrow what is drawn, client-side, out of a catalog sent whole.
- Two picker shapes is more UI than one, and the seam between them is a property test (`puzzles` present or absent), the kind of implicit contract that rots if a third provider kind appears.
- A host can now deliberately pick a puzzle the room has solved, so `served` no longer guarantees what it used to.
- The room's settings still record only size and difficulty, so "start another" after a banked puzzle re-opens the list. That is wanted, but it means the spec that starts a puzzle and the spec a room remembers are no longer the same object.

## Alternatives rejected

**Keep the three questions and let the bank choose.** What shipped in Phase 4. It treats a crossword as a specimen of a class, which is what a crossword is not.

**Give every type a list, generating a few sudokus up front to populate it.** Makes the interface uniform by making the generator worse: it would produce puzzles nobody asked for, hold them, and throw most away, so the picker could pretend a sudoku has an identity. The two supplies are genuinely different and the interface should say so.

**Put `puzzleId` in the room's settings.** Would make "start another" offer the same crossword again, which is not what anybody means by another.

## Revisions

| Change | Original | Why | When |
|---|---|---|---|
| Filters over the card list, on size and difficulty | Deferred as "sound at a thousand puzzles and pure clutter at four" | A bank with two sizes and three difficulties made the list worth narrowing, and it cost a component change and nothing else. The clutter objection was answered rather than overruled: a row is drawn only where the bank has more than one value, so the four-mini case still shows a list and nothing above it | 2026-08-07 |
| The card states its difficulty | This ADR claimed it did, and it did not | A filter narrowing on a fact the cards do not show is a guessing game | 2026-08-07 |
