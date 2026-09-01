# ADR-0018: A type explains itself, from the caption

**Status**: accepted · **Date**: 2026-08-30 · **Phase**: 5

## Context

Five puzzle types ship, and nothing on screen says how any of them is solved. That was tolerable
while the app was sudoku and crosswords, which most people arrive already knowing. It stopped being
tolerable at kakuro, whose entire structure is printed on the squares nobody writes in: a clue square
carries two numbers either side of a diagonal, and which number governs which run is a convention, not
something the grid can show. A solver meeting one for the first time has no way in.

The room makes it worse rather than better. Only the host passes through Puzzle Select, so any
explanation put there reaches exactly one of the people looking at the grid, and it reaches them
before the moment they need it.

Two questions were being conflated in early drafts, and separating them is most of the design:

1. **What are the rules of this type?** Stable, prose, read once. Kakuro needs the most of it;
   crossword needs the least.
2. **How is it operated here?** Which of Notes, a brush, or Rebus is beside the keys, and what a drag
   does. Partly per type, and the part a returning player actually comes back for.

## Decision

**One `<pt-help>` dialog per puzzle type, opened from a wordless `?` at the end of the puzzle header,
with its content in `client/ui/help-text.js`.**

Three parts, in that order:

- **The entry point is the caption, not the puzzle-action row.** That row is defined by scope:
  everything in it acts on the room's puzzle or on your seat in it, which is the rule that keeps
  somebody reaching for Undo from landing on Reveal. Help acts on nothing. It also costs no space
  there: a host's four buttons already come to about 618px against the row's 480 and wrap Leave Room
  onto its own line, so a fifth would buy a third line for a control nobody presses twice. On the
  caption it sits on the words it explains, and every player has it, host or not.
- **The surface is a native `<dialog>`**, like `<pt-confirm>`, `<pt-about>`, and `<pt-clue-list>`.
  Focus trapping, Escape, and the inert backdrop come from the platform, and the same argument the
  clue list settles applies here: this is read once and then not wanted, so a permanent panel beside
  the grid would cost the grid width on every solve to answer a first-solve question.
- **The content is one table with a fixed shape**, `{ goal, rules[], input }` per type. Fixed shape
  is what lets one dialog render any type without a branch, and what lets Puzzle Select print `goal`
  alone under the puzzle-type row without cutting a sentence in half. `input` is where the second
  question above lives, under its own heading, so a returning player can skip the rules.

**The table is a second per-type entry, not a field on the board registry.** `boards/registry.js`
declares what draws a type and how it is typed into; paragraphs about kakuro runs are not that.
Adding a type is therefore two client entries rather than one, which design-spec.md §7 now records.

**The two entries fail differently, deliberately.** `boardFor()` throws at an unknown type, because a
build that cannot draw a puzzle is broken. `helpFor()` returns `null`, because a build that cannot
explain one is still playable, and both screens answer a `null` by leaving the way in undrawn.
`client/ui/help-text.test.js` is what stops that quiet degradation being how a missing entry is
found: it asserts every `PUZZLE_TYPES` entry exists and holds a one-sentence goal, two to four rules,
and an input line.

## Consequences

- **A fifth wordless icon.** brand.md's enumeration grows by one. `?` earns it on the same ground
  the icon set already records: it is a glyph that is already a word. It was ⓘ for one revision,
  which said "here is what this thing is" beside a caption that already answers that; the question
  mark offers the rules, which is what is actually being asked for.
- **The puzzle header is a flex row** rather than a centred text run. Aligning a box against a line
  of type is `vertical-align` arithmetic, and grid alignment is the one place this app has shipped a
  Firefox-only bug (trap 10). Centring both as flex items asks neither engine for a baseline. It
  wraps, so a long caption at 320px drops the control to its own line instead of widening the page.
  The row then needs **an empty leading item of the control's own width**, because flex centring
  divides the row between everything in it and the caption would otherwise sit half a control left
  of centre, beside a grid centred properly. The alternative, a negative margin letting the control
  overhang, was not taken: at 320px a full-width caption would push it past the viewport edge, and
  no horizontal scroll at 320px is a standing brand check.
- **The header grew by about 10px**, the difference between a `--text-lg` line and the 2.25rem box.
  That is the whole layout cost, and it is above the grid rather than inside the panel's 16rem.
- **The goal sentence is stated once and rendered twice.** Puzzle Select and the dialog read the same
  field, so the host's reason for choosing a type and the room's explanation of it cannot drift.
- **Nothing is persisted.** There is no "seen it" flag and no first-run coach, so a player who wants
  the rules presses the same control every time. That is a deliberate floor, not an oversight; see
  below.

## Alternatives rejected

**A button in the puzzle-action row.** The obvious place, and it fails on the rule that row exists to
enforce. Scope is what divides those four controls from the panel's Erase and Undo, and a control
that acts on nothing at all blunts it. The wrap arithmetic is the second reason, not the first.

**A control in the keypad's action slot.** Thumb-adjacent, and crossword's `Clues` button is
precedent for an extra control there. But that slot is spec'd as the one setting that changes what a
key press means, the controls share the row at `flex: 1 1 0`, and crossword already runs five of them
on a 320px screen. There is no room, and it would be the second control there that is not a setting.

**Puzzle Select only.** Host-only and pre-game: it reaches one person in the room, before the moment
of confusion, and never again. Kept as the goal sentence, which is the half that genuinely belongs to
choosing; rejected as the whole feature.

**A dismissible first-time coach under the header**, persisted per device. The best timing of any
option, and per-device persistence is right here, since confusion belongs to a person and not to a
room. Rejected as a first move rather than on the merits: it is new state and a new dismissal
contract, and it still needs a permanent entry point for the second time somebody forgets. It layers
onto this cleanly if it is ever wanted, as a pointer at the `?` rather than a second copy of the text.

**Contextual help anchored to the confusing object**, so tapping a kakuro clue square explains the two
sums. The highest-value version and the one that cannot be afforded: it is per-type work inside each
board subclass, which is exactly the cost design-spec.md §7 says a new type must not carry.
