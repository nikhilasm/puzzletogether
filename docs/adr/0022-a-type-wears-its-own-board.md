# ADR-0022: A puzzle type wears its own board

- **Status**: Accepted
- **Date**: 2026-09-02
- **Context**: [brand.md §4](../brand.md#icons) · [design-spec.md §4](../design-spec.md#puzzle-select) · [ADR-0009](0009-a-bank-is-browsed-not-described.md) · [ADR-0012](0012-a-label-under-every-icon.md) · [ADR-0018](0018-a-type-explains-itself.md)

## Context

Puzzle Select asks three questions, and until now it asked them all the same way: a wrapping row of word buttons for the type, another for the size, another for the difficulty. Two of those rows choose between **values of one kind**. 4×4 against 9×9, easy against hard: the words are the whole of the difference, and a picture of either would be decoration.

The type row is not that question. It chooses between **games**, and a host who has not played kakuro cannot read the word and know what they are asking the room to spend twenty minutes on. ADR-0018 already answered half of this by putting the type's goal sentence under the row, and that sentence is doing real work; it is also one sentence about one type, read after the choice has been made, which does nothing for the host scanning six names deciding which to try.

Six is also where the row stopped working as a row. It was built for four and sized at 28rem for the width at which four stopped wrapping; suguru and kakuro made it six, which wraps to four and two and reads as two groups of puzzles rather than one set of six.

## Decision

**Each puzzle type gets a mark of its own board, and the type row becomes a grid of tiles.**

- Six new icons in `client/ui/icons.js`, exported individually and as `puzzleTypeIcons` keyed by the wire value, so a new type adds a drawing and nothing else. A type with no entry renders no mark and degrades to the labelled button it used to be.
- **Every mark is the same 2×2 of rounded cells on the same 24×24 box.** What tells them apart is what is printed in the squares: crossword's blocks and letters, sudoku's four digits with two set as givens, nonogram's fill and cross, KenKen's four operators, kakuro's split clue square, suguru's three squares drawn as one region beside a fourth that is not in it. Suguru is the one that departs from four separate cells, and it has to: the region is the type, so it is one outline rather than three cells with a rule between them, which is how a suguru board draws it.
- `typeIconStyle`, alongside `iconStyle`, carries the parts a stroked outline set does not have: `.block` fills and keeps its stroke, so a filled square is the same size as an outlined one; `.wash` fills at 18% for a given; `.glyph` prints a character in `--font-ui`; `.heavy` draws a region rule at 2× the icon stroke. A shadow root that composes only `iconStyle` gets empty outlines.
- **The chosen tile's mark takes `--accent-text`**, one property for the whole drawing, since every part of a mark is painted from `currentColor`. It is the panel's pressed-glyph channel (ADR-0011) without the 35% fill wash, which exists there to keep an outline set legible when filled and would only muddy marks that already fill what they mean to.
- **The grid is three columns by two, fixed, dropping to two columns below 30rem**, not `auto-fit`. Six tiles fitted to the available width put four on one line and two on the next.
- Each tile is the mark **over** the name, at a `min-height` that keeps the six one height. That is ADR-0012's arrangement, for its reason: beside the word, a tile is as wide as its own label and the six stop being one size.
- The tiles keep `.option`, so the accent wash marking the chosen one is the same paint every other choice on the screen carries, `aria-pressed` still says which, and the marks are `aria-hidden` behind the name that was always there.

## What was rejected

**Six unrelated drawings, one per type.** This is what brand.md §4's rule about two icons looking different would suggest, and it is wrong here. These six are one question's answers, read side by side and once a session. Six unrelated marks are six things to learn; six boards told apart by their contents is one thing to learn, six times, and the shared frame is what makes the difference between them legible at 32px.

**Keeping the marks free of letters.** `rebus`'s comment states the rule this bends: a letterform in an icon is a word in disguise. It is a rule about *inventing* a lettered glyph for an idea that has a shape. A sudoku's squares hold digits; drawing something else in them would be drawing a different puzzle. These are the only icons in the set that set actual type, and the bend stops here.

**A screenshot or a rendered thumbnail per type.** Truer, and the wrong medium: a raster needs a second asset for the dark theme, cannot grey out with a disabled control, and at tile size a real 9×9 sudoku is a grey smear. The marks inherit `currentColor` like every other icon, so all of that comes for free.

## Consequences

**Good**

- A host can tell the six types apart before reading a word, and the goal sentence under the grid now answers a question they have already half-answered by looking.
- Six tiles are one shape at every width the fieldset takes; the wrap that put four and two on separate lines is gone.
- The congrats modal's "start another" gets the change for nothing, since it mounts the same `<pt-puzzle-picker>`.
- A seventh puzzle type has one more thing to supply, and it is one drawing in one file.

**Bad, and accepted**

- **A seventh type that forgets its mark fails quietly**, rendering a tile with a word and a gap where the drawing goes. The map's fallback is deliberate: a missing key should not blank the picker. `PUZZLE_TYPES` and `puzzleTypeIcons` have to be kept in step by hand.
- **The marks carry type, so they carry a font.** `--font-ui` is loaded by the time Puzzle Select renders, but a mark drawn before it lands falls back to the system sans for a frame.
- **The type row is taller than it was**, by roughly one line of the goal sentence's height, on a screen that also holds a card list. It is above the fold at 320px and was measured there.
- Six drawings to redraw if the icon set's line weight ever changes, where the old row had none.
