# ADR-0012: A label under every icon in the panel

- **Status**: Accepted
- **Date**: 2026-08-09
- **Context**: [ADR-0011](0011-icons-in-the-panel-words-in-the-page.md), whose central decision this reverses · [brand.md §4](../brand.md#icons) · [design-spec.md §4](../design-spec.md#4-the-game-screen)

## Context

ADR-0011 stripped the labels from every control in the input panel, one day ago, on one argument: the button bar wrapped to two rows at 320px and that row was charged against the grid on every phone screen.

**Tried, and the space was not there.** The panel's height is set by the rows of keys below the button bar, and the panel is a fixed strip at the foot of the viewport. Shrinking the bar did not raise the keys; it left a gap above them. The one measurement the decision rested on was never taken.

The diagnosis was wrong as well as the cure. The bar wrapped because each button was shrink-to-fit and took the width of its own word, so a long label made a wide button and four wide buttons did not fit. That is a layout property, not a labelling one. Buttons that *share* the row fit whatever their labels say.

So ADR-0011 paid its whole stated cost, an unfamiliar icon being a guess on a touch screen, and bought nothing.

## Decision

**Every control in the input panel carries a one-word label under its icon, and the bar is one row because its buttons share it.**

- `.action` in `client/styles/controls.js`: `flex: 1 1 0` with `min-width: 0` and a `max-width` cap, icon above label, label ellipsed rather than wrapped. Four come to 236px where side-by-side labels came to 330px, against the 296px a 320px screen has to give.
- The label steps from `--text-sm` to `--text-xs` below 30rem, the same breakpoint at which the digits drop to fewer columns.
- **`<pt-mode-toggle>` and `<pt-brush-bar>` become `display: contents`**, so their buttons are direct flex items of the bar. Boxed, nonogram's three brushes were one flex item against Undo's one and took half the row between them.
- **The icons are a fixed `1rem`, not `iconStyle`'s `1.25em`.** These buttons sit in four shadow roots with four inherited font sizes, so the same icon came out 25px, 20px, and 17px in one row. An em is right for an icon inside a sentence and wrong for one in a fixed strip of controls.

**What ADR-0011 got right and keeps**: settings are `aria-pressed` buttons, not switches; Leave Room sits in the action row at full size with the `--danger` accent; the footer is two icon buttons over two small links with `<pt-about>` holding the version; and the footer's two controls stay wordless, being peripheral, alone on their line, and about as legible as an icon gets.

**Two things move while the bar is being rebuilt:**

- **Crossword's Backspace leaves the letter pad for the button bar.** A phone keyboard's ⌫ is a key among keys; ours clears a square and steps back along the entry, which is what Erase and Undo do. The pad is now letters and nothing else.
- **Clues leads the row**, ahead of Rebus, Undo, and Backspace. It is the only control there that does not act on the square you are on. Backspace ends the row, nearest the letters it corrects, being the one control reached for mid-word.

## The rule that replaces ADR-0011's

ADR-0011 said frequency decides whether a control keeps its word. It does not; nothing does, because a word costs nothing when the layout is right. What frequency decides is **size and placement**:

> A control keeps its word. Where a control is pressed constantly, it goes in the pinned panel, at thumb size, with its label under its icon. Where it is pressed once or twice, it goes down the page with its label beside its icon.

## Consequences

**Good**

- The bar is one row at 320px in all four types, labels and all, by the mechanism that actually produces it.
- The open question about unlabelled panel controls closes without a playtest: there is none left to fail to find.
- `display: contents` on the two wrappers means every control in the bar is one flex item, so all are the same width in every type. The brushes used to be visibly narrower than Undo.
- Fixing the shrink-to-fit layout is what fixed the wrap, and that fix is independent of the labels: a fifth control would now shrink the row rather than wrap it.

**Bad, and accepted**

- **`display: contents` is load-bearing and quiet.** A wrapper that forgets it silently becomes one flex item holding several buttons, and the row goes uneven rather than broken. `tests/puzzle-types.spec.js` asserts the four nonogram controls are one width.
- **`display: contents` removes the host's box**, so `<pt-mode-toggle>` cannot be measured with `boundingBox()` and its `role="group"` had to move onto the host in `connectedCallback`. Both surprised a test first.
- **The labels are `--text-xs` on a phone**, small for a primary control. The icon carries the meaning and the word confirms it, which is the arrangement every mobile tab bar uses at the same size.
- Eight words to translate if this is ever localised.

## What this says about the previous one

ADR-0011 was written, shipped, and reversed in two days, and the reversal was one measurement long. The lesson is not that it should have been argued harder; the reasoning was fine and the cost was named honestly. It is that **the measurement it rested on was never taken**: "the bar wraps to two rows" was observed, and "therefore the panel is a row taller" was assumed. The second one mattered and was false. A decision that claims to buy space should say how much and be checked.
