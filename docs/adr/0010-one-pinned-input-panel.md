# ADR-0010: One pinned input panel, for every puzzle

- **Status**: Accepted
- **Date**: 2026-08-06
- **Context**: [design-spec.md §4](../design-spec.md#the-input-panel) · [ADR-0008](0008-native-keyboard-for-crossword.md), which this reverses · [TODO.md open questions](../TODO.md#open-questions)

## Context

ADR-0008 gave crossword the phone's own keyboard on the strength of a playtest: solvers wanted the letters where their thumbs already expected them. That finding was real and has not been withdrawn.

**What the next playtest found is that the keyboard is fine and everything around it is not.** On an iPhone:

- Half the actions a solver takes dismiss the keyboard. Tapping a square, opening the clue list, toggling Rebus, scrolling the grid: each is a normal move, and each ends with the keyboard gone and the grid jumping back to full height under a thumb mid-gesture.
- The pinned bar above it was, in the report, "flaky at best". It is positioned from `visualViewport`, which updates asynchronously and reports different things mid-animation on different platforms, so the bar lags the keyboard, overshoots it, or briefly sits under it.
- A grid too tall for the screen still could not be scrolled while typing, which was the problem the arrangement was meant to solve.

None of this is a bug to be fixed. It is what a fixed control strip against a viewport somebody else animates costs, and ADR-0008 named the pieces of it. The wager was placed knowingly and it has been called.

## Decision

**Crossword takes a pad of ours again, and the pad becomes a single pinned input panel that every puzzle type uses.**

`<pt-keypad>` is `position: fixed` at the foot of the viewport, for sudoku, kenken, nonogram, and crossword alike, with `env(safe-area-inset-bottom)`. It holds, top to bottom:

1. **The clue strip** (crossword only), which is also the next-clue button, unchanged from ADR-0008 in every respect but where it lives.
2. **The button bar**: this type's one setting (Notes, a brush, or Rebus), plus Erase and Undo, and for crossword the way into the clue list.
3. **The keys**: the digits, or the three **QWERTY** rows.

Around that:

- **The keys are QWERTY, not A–Z.** The one thing a pad of ours can borrow from the keyboard it replaces is the arrangement, and that is most of what ADR-0008's playtest was reporting.
- **Registry vocabulary**: crossword's `input` goes from `native` to `letters`, joining `digits` and `brushes`. There is no such thing as a type that renders no panel.
- **Everything that acts on a square is in the panel; everything that acts on the puzzle stays down the page.** That separation is Phase 2's, drawn as a rule under a hairline. It is now a difference between two kinds of place, which says the same thing without needing to be read.
- **The page reserves the panel's height at its very foot**, in `<pt-app>` rather than in `<pt-game>`. The panel reports its own measured height; the shell keeps a spacer that tall after the footer.
- **`<pt-board>` gives back what ADR-0008 took.** `renderOverlay()`, `focusTarget`, `describeCell()`, and the host-level key listener all existed to serve the hidden input and are removed. Keys are read on `.grid` again, as through Phase 3.

## Consequences

**Good**

- **The layout does not move.** Nothing appears, disappears, or resizes under a thumb, because nothing on this screen is drawn by the platform. That is the whole of what was bought.
- **The grid can be scrolled and read at any time**, keys and clue included, which is what makes a 15×15 playable on a phone.
- **One arrangement for every type.** A solver moving between sudoku and crossword finds the same panel in the same place with different keys in it, and `<pt-game>` has one input path rather than a native branch and a keyed branch.
- The `visualViewport` measurement, the offscreen `<input>`, the `beforeinput`/`inputType` reader, the Android IME workaround, and the shadow-root `focusin` redirect are all deleted.
- Erase, Undo, Notes, brushes, and Rebus are within thumb reach at every scroll position, for the first time on any type.

**Bad**

- **The panel costs a fixed share of the screen**, around 16rem for a crossword on a phone against roughly 3rem for the old clue bar. This is the cost ADR-0008 avoided, paid because a screen that is smaller but stationary beats one that is larger and moves.
- **Thumbs know the platform keyboard better than they will ever know ours.** QWERTY narrows that gap; it does not close it. This decision says the gap is worth less than a stable layout, which is a judgement and not a measurement.
- **No word suggestions, no swipe typing, no dictation.**
- The panel's height has to be measured and fed back to the page: a `ResizeObserver` and an event crossing two shadow roots. Simpler than `visualViewport`, not free.
- **Backspace exists on the pad but Erase does not**, for crossword only. ⌫ takes a letter out and steps back, which is the correction a solver means; emptying a rebus square is still one press per letter.
- **Turning the cursor around still has no button on a touch screen.** Re-tapping the square remains the only way. This change does not address it.
- Every control in the panel must suppress focus-stealing on `pointerdown`, or the grid blurs and the physical keyboard stops working mid-solve.

## Alternatives rejected

**Keep the native keyboard and fix the bar.** There is nothing to fix. The bar is correct and the viewport underneath it is not stable; `visualViewport` is the only instrument available and it is the one reporting late.

**Native on desktop, our pad on touch.** Two input paths to keep in step, rejected on the same grounds in ADR-0008 in the other direction. A desktop already has a physical keyboard, and it reaches the grid unchanged either way.

**A–Z keys instead of QWERTY.** Easier to search, which sounds right until you notice nobody searches a keyboard they have used ten thousand times.

**Let the panel collapse to reclaim grid space.** More screen for a 15×15, at the price of a state the player can be stuck in, a control to explain, and a question with no good answer: does tapping a square re-open it? If 16rem proves too much, this is the first thing to revisit.

**Pinch-zoom and pan on the board.** Page scroll already delivers scroll and navigation. Real zoom is a gesture layer that would contest nonogram's drag-to-paint and crossword's tap-to-select, and it is its own pass.
