# ADR-0023: The footer is one panel, and its controls are wordless

- **Status**: Accepted; the changelog's storage amended by [ADR-0024](0024-the-changelog-is-a-file.md), 2026-09-03
- **Date**: 2026-09-03
- **Context**: [ADR-0012](0012-a-label-under-every-icon.md), whose rule this qualifies · [ADR-0011](0011-icons-in-the-panel-words-in-the-page.md) · [brand.md §4](../brand.md#icons) · [design-spec.md §4](../design-spec.md#4-the-game-screen)

## Context

The footer held four labelled controls: Theme, About, GitHub, Report, drawn with the input panel's own `.action` and capped at 22rem so they came out the width the panel draws its controls at. That was ADR-0012's arrangement applied to the one bar in the app that is not about a puzzle.

Two things were wrong with it, and the second is the one that matters.

**It looked like the panel.** Four outlined boxes at the panel's width, with the panel's icon-over-word layout, said these four are the same kind of thing as Notes, Erase, and Undo. They are not. Nothing in the footer acts on a puzzle, a room, or a seat; they are the app's own switches, and reading them as peers of the controls a solver presses hundreds of times a puzzle overstates every one of them.

**It could not grow.** Six is where the layout stops working, and six is what the footer now needs: a changelog, and a link to the author's site, on top of the four. Four labelled boxes come to 236px stacked, which fits a 320px screen; six of them do not, and a fifth or a sixth would have wrapped, ellipsed the words, or shrunk them below `--text-xs`. That is the same shrink-to-fit trap ADR-0012 diagnosed in the panel, arriving from the other direction: there the buttons were sized by their words, here they are sized by how many of them there are.

## Decision

**The footer is one full-width panel, divided equally between however many icon-only controls it holds, each named by a tooltip on hover and by an accessible name always.**

- `.toolbar` in `<pt-app>` is the surface: a 1.5px rule, `--radius-control`, `--paper-raised`, capped at the 22rem the footer's bar has always taken. `.tool` is a division of it, with no border, no ground, and no radius until it is pressed. The panel is the box; drawing a second one inside each control is what made the old footer read as four separate decisions. **The panel has no padding of its own**, so a control's 2.75rem is the whole of its height: a ring of padding around a strip of icons is 8px of nothing on a bar that is a footnote to the page.
- **The controls flex `1 1 0`**, so the spacing is a property of the bar rather than a gap anybody has to maintain. A seventh control changes one line of markup and nothing else.
- **Six of them, in this order**: theme, About, changelog, GitHub, report an issue, homepage. The three that leave the app are still anchors, so a middle click still opens a tab.
- **Icons are a fixed `1.25rem`**, a step up from `.action`'s `1rem`, because here the drawing is the whole of the control and there is no word under it to be read instead.
- **`<pt-tooltip>` is a new wrapper element**, `client/ui/pt-tooltip.js`. It shows a one- or two-word bubble above the control on `pointerenter` and on `focusin`, and hides it on the way out. The bubble is `aria-hidden` and is never the only copy of the name: the control inside carries an `aria-label`, which is what a screen reader reads and what `tests/game.spec.js` asserts.
- **The hover query is checked in JavaScript**, not in CSS. `@media (hover: hover)` gates a *rule*; what has to be gated here is a *state*, and a touch browser that emulates hover on the last-tapped element would otherwise leave a bubble parked over it. The tooltips are therefore pointer-and-keyboard only, which is accepted: a phone has no hover to spend.
- **Every bubble is centred on the control it names, and moves only when a viewport edge makes it.** It is wider than the control it sits over, so on a 320px screen the outermost one would hang off the side and give the page a horizontal scroll, which is the one thing the layout may not do (brand.md §7). The bubble measures itself on the frame it appears and shifts by the overhang and no more.
- **A new `<pt-changelog>` dialog**, built on the native `<dialog>` like `<pt-about>` and holding its releases as a constant in the file. A changelog is written by hand when a version ships and is the same for everybody; fetching it would put a spinner in front of prose already in the bundle. *(Amended: the releases are `CHANGELOG.md` at the root, inlined at build time. The reasoning for keeping them in the bundle stands; the address was wrong. → [ADR-0024](0024-the-changelog-is-a-file.md))*

## The rule this qualifies

ADR-0012 said a control keeps its word, and frequency decides only size and placement. That stands everywhere a solver works. The footer is the exception, and it is a narrow one:

> A control keeps its word wherever it acts on the puzzle, the room, or your seat in it. The app's own peripheral controls, pressed once a session or never, may be icon-only inside one panel, provided the name is still carried by the accessible name and offered on hover.

**Why this is not ADR-0011 again.** ADR-0011 stripped the labels from the controls a solver presses constantly, to buy vertical space it turned out not to buy. Nothing is being bought back here: the footer is the same height it was. What changes is that six things fit where four did, and the six that fit are the ones nobody presses mid-solve. The cost ADR-0011 paid, an unfamiliar icon being a guess on a touch screen, is paid here too and it is paid on GitHub, About, and a house rather than on Erase and Undo.

## What was rejected

**Keeping the labels and letting the bar wrap to two rows.** Two rows of six is the shape the footer had before ADR-0012's predecessor, and it reads as two groups. The controls are one group.

**Labels that appear below `--text-xs`.** Six words across 288px is 48px a word, which ellipses "Changelog" to about four characters. A truncated word is worse than no word: it looks like a bug rather than like a decision.

**A `title` attribute instead of an element.** It is free and it is the wrong drawing: the platform tooltip is a system-styled box in a system font on a system delay, which is exactly the "somebody else's artwork at somebody else's weight" that gets emoji banned as icons in brand.md §1. It also cannot be positioned, so it sits where the pointer is rather than over the control it names.

**Aligning the outermost bubbles to the panel's edge instead of measuring.** Built, and it solved the 320px overhang by moving two of the six bubbles on every screen, including the desktop ones with 400px of clear space either side. A label visibly off-centre from the icon it belongs to looks like a bug on the common case to avoid one on the rare case; a measurement moves nothing until something is actually in the way.

**`role="toolbar"` on the panel.** The role promises arrow-key navigation between the controls, which is not implemented and would be a second keyboard model for six things Tab already reaches in order.

## Consequences

**Good**

- Adding a control is one `<pt-tooltip>` in the markup. Nothing is sized by hand and nothing has to be re-measured.
- The footer stops competing with the puzzle actions: one quiet strip rather than a row of boxes at the panel's own weight.
- The theme control keeps everything ADR-0012 gave it. Its icon is still the theme it would leave you in, its accessible name is still the sentence, and the tooltip is the destination for the same reason the icon is.

**Bad, and accepted**

- **On a phone, six icons and no words.** GitHub's mark and a house are recognisable; a page with a turned corner meaning "changelog" is a guess. The accessible name is exact, and nothing behind these six controls is destructive or hard to come back from.
- **`<pt-tooltip>` is a wrapper with a box**, not `display: contents`, because the bubble is positioned against it. That is the inverse of the trap ADR-0012 recorded on `<pt-mode-toggle>`, and it means the wrapper carries the flex sizing its control used to.
- **The bubble is a seventh surface to keep in step with the brand** if the control palette ever changes: a rule, `--paper-raised`, and no shadow, since there is exactly one shadow in this app.
- **Showing a bubble reads layout.** It measures itself against the viewport on the frame it appears, which is a forced reflow on hover. It is one element on a peripheral control and no board is being drawn at the time.
- **Two more icons to redraw** if the set's line weight ever changes, and a twenty-ninth icon is now in the set.
