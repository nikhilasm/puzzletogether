# ADR-0012 — A label under every icon in the panel

- **Status**: Accepted
- **Date**: 2026-08-09
- **Context**: [ADR-0011](0011-icons-in-the-panel-words-in-the-page.md), whose central decision this reverses · [brand.md §4](../brand.md#icons) · [design-spec.md §4](../design-spec.md#4-the-game-screen)

## Context

ADR-0011 stripped the labels from every control in the input panel, one day ago, on one argument: the button bar wrapped to two rows at 320px and that wrapped row was charged against the grid on every phone screen.

**Tried, and the space was not there.** The panel's height is set by the rows of keys below the button bar, and the panel is a fixed strip at the foot of the viewport. Shrinking the bar did not raise the keys; it left a gap above them. The one measurement the decision rested on turned out not to be a measurement of anything — nobody had checked that a shorter bar made a shorter panel, and it does not.

Worse, the diagnosis was wrong as well as the cure. The bar wrapped because each button was shrink-to-fit — it took the width of its own word — so a long label made a wide button and four wide buttons did not fit. That is a layout property, not a labelling one. Buttons that *share* the row fit whatever their labels say.

So ADR-0011 paid its whole stated cost — an unfamiliar icon is a guess on a touch screen, logged as [open question 15](../TODO.md#open-questions) — and bought nothing.

## Decision

**Every control in the input panel carries a one-word label under its icon, and the bar is one row because its buttons share it.**

- `.action` in `client/styles/controls.js`: `flex: 1 1 0` with `min-width: 0` and a `max-width` cap, icon above label, label ellipsed rather than wrapped. Four of them come to 236px where side-by-side labels came to 330px, against the 296px a 320px screen has to give.
- The label steps from `--text-sm` to `--text-xs` below 30rem, the same breakpoint at which the digits already drop to fewer columns.
- **`<pt-mode-toggle>` and `<pt-brush-bar>` become `display: contents`**, so their buttons are direct flex items of the bar rather than a box inside it. Boxed, nonogram's three brushes were one flex item against Undo's one and took half the row between them.
- **The icons are a fixed `1rem`, not `iconStyle`'s `1.25em`.** These buttons sit in four different shadow roots with four different inherited font sizes — the keypad's own rule sets `--text-lg`, `<pt-game>`'s sets `--text-base`, and the two slotted wrappers set nothing and inherit from the page — so the same icon came out 25px, 20px, and 17px in one row. An em is right for an icon inside a sentence and wrong for one in a fixed strip of controls, which should match each other rather than their containers.

**What ADR-0011 got right and keeps:**

- Settings are `aria-pressed` toggle buttons, not `role="switch"`. One pattern, the brushes'.
- Leave room sits in the puzzle-action row at full size with the `--danger` accent.
- The footer is two icon buttons over two small links, with `<pt-about>` holding the version.
- The footer's two controls stay wordless. They are peripheral, they sit on a line of their own with nothing to align to, and a sun and an ⓘ are about as legible as an icon gets.

**And two things move while the bar is being rebuilt:**

- **Crossword's Backspace leaves the letter pad for the button bar.** A phone keyboard's ⌫ is a key among keys; ours clears a square and steps back along the entry, which is what Erase and Undo do and not what pressing a letter does. Having it in the pad's corner was borrowing a shape without the reason for it. The pad is now letters and nothing else.
- **Clues leads the row**, ahead of Rebus, Undo, and Backspace. It is the only control there that does not act on the square you are on — it opens the puzzle's other half. Backspace ends the row, nearest the letters it corrects: it is the one control here reached for mid-word, where Undo is occasional and is about the puzzle rather than the square.

## The rule that replaces ADR-0011's

ADR-0011 said *frequency decides whether a control keeps its word*. It does not; nothing decides that, because a word costs nothing when the layout is right. What frequency decides is **size and placement**, which is what the panel was always really buying:

> A control keeps its word. Where a control is pressed constantly, it goes in the pinned panel, at thumb size, with its label under its icon rather than beside it. Where it is pressed once or twice, it goes down the page with its label beside its icon.

## Consequences

**Good**

- The bar is one row at 320px in all four types, labels and all — the outcome ADR-0011 wanted, by the mechanism that actually produces it.
- [Open question 15](../TODO.md#open-questions) closes without a playtest: there is no unlabelled panel control left to fail to find.
- `display: contents` on the two wrapper components means every control in the bar is one flex item, so they are all exactly the same width in every type. The brushes used to be visibly narrower than Undo.
- Fixing the shrink-to-fit layout is what fixed the wrap, and that fix is independent of the labels — a fifth control would now shrink the row rather than wrap it.

**Bad, and accepted**

- **`display: contents` is load-bearing and quiet.** A wrapper component that forgets it silently becomes one flex item holding several buttons, and the row goes uneven rather than broken. `tests/puzzle-types.spec.js` asserts the four nonogram controls are one width, which is the check that would catch it.
- **`display: contents` removes the host's box**, so `<pt-mode-toggle>` cannot be measured with `boundingBox()` and its `role="group"` had to move onto the host element in `connectedCallback`. Both are small, and both surprised a test first.
- **The labels are `--text-xs` on a phone**, which is the size the footer links use and small for a primary control. The icon above it carries the meaning and the word confirms it, which is the arrangement every mobile tab bar uses at the same size.
- A word in a button is a word to translate, if this is ever localised. Eight of them.

## What this says about the previous one

ADR-0011 was written, shipped, and reversed in two days, and the reversal was one measurement long. The lesson is not that it should have been argued harder — the reasoning was fine and the cost was named honestly. It is that **the measurement it rested on was never taken**: "the bar wraps to two rows" was observed, and "therefore the panel is a row taller" was assumed. The second one is the one that mattered and it was false. A design decision that claims to buy space should say how much and be checked.
