# ADR-0008 — Crossword takes the phone's keyboard, not ours

- **Status**: Superseded by [ADR-0010](0010-one-pinned-input-panel.md) on 2026-08-06
- **Date**: 2026-08-05
- **Context**: [design-spec.md §4](../design-spec.md#the-input-panel) · [TODO.md open question 11](../TODO.md#open-questions) · reverses a Phase 4 decision

> **Superseded.** A playtest on a real iPhone found the keyboard itself fine and everything around it
> unworkable: half of a solver's ordinary actions dismiss it, and a control bar positioned from
> `visualViewport` lags it. ADR-0010 returns crossword to a pad of ours — and pins that pad, for every
> puzzle type. The decisions below about *what the clue strip does* survive intact: it is still "7D"
> rather than "7 Down", and pressing it still walks to the next clue in the direction being worked.
> What did not survive is where the keys come from.

## Context

Phase 4 gave crossword a letter pad of its own — `<pt-letter-pad>`, a QWERTY grid in the slot the digits and brushes already occupied — rather than summoning the phone's keyboard. Three arguments were made for it, and all three are still true:

- A native keyboard arrives with autocapitalize, autocorrect, and predictive text, all of which fight a grid that wants exactly one letter at a time.
- It takes a share of the viewport the page cannot query reliably or influence at all, which on a 15×15 decides whether the grid is visible.
- Reaching it needs an offscreen `<input>` holding focus, which is the fragile trick every crossword on the web maintains per platform.

The design did not pretend this was settled. It was recorded as **the wager against the platform** in §14 and as open question 11, with an explicit instruction: check it against a real thumb early, not at the end of the phase.

**It was checked on 2026-08-05, by two people solving a 15×15 together, and it lost.** Players want the keyboard they already know. That preference beats all three arguments, because none of them is about the thing a solver actually experiences — which is that their thumbs know where the letters are, and on our pad they do not.

## Decision

**Remove `<pt-letter-pad>`. Crossword's registry entry returns to `native`.**

- A focused, visually-present-but-hidden `<input>` summons the OS keyboard and becomes the **single source of crossword key events on every platform**, desktop included. The grid stops holding keyboard focus; `:focus-within` keeps the focus ring where it belongs.
- Keystrokes are read from `beforeinput` / `input` and their `inputType`, not from `keydown`. Android IMEs report `keydown` as keycode 229 with `key: 'Unidentified'`, so a `keydown`-based reader works on desktop, appears to work in an emulator, and fails on real phones.
- The clue bar becomes a **pinned bar** fixed above the keyboard, positioned from `visualViewport`. It carries, in one row: the current clue, the **Rebus** toggle, **Undo**, and **All clues**.
- **The clue itself is a "next clue" button**, walking the direction being worked — 7D to 8D — rather than the direction toggle it used to be. There is one strip of bar to give away, and moving on is what a solver does dozens of times a puzzle where turning around is what they do when a crossing goes wrong. Turning around is left to **re-tapping the square the cursor is on**, which is the gesture every crossword app already teaches, and to Space and the perpendicular arrow on a keyboard.
- The direction is written **"7D", not "7 Down"**, because the bar now holds a clue and four controls on a phone and four characters of every entry is a real cost. The full words stay in the button's accessible name, where there is no such pressure.
- **Erase is dropped.** It cleared the selected square — the counterpart to pressing a letter into it — and the keyboard's own ⌫ is now that key. This is the same reasoning §4 already used to drop Erase from nonogram's brush bar, applied a second time rather than invented.
- **Undo stays**, as it always does. Phase 2's rule is that every way of changing a cell is within thumb reach, and mistyping is exactly when Undo is wanted, so it cannot be allowed to scroll away behind the keyboard.

## Consequences

**Good**

- Solvers type on the layout their muscle memory already holds, which is the whole of the finding.
- Less UI to build, style, test, and keep aligned with the brand — a whole component and its browser checks go away.
- The grid gets back the vertical space the pad occupied, which matters most on the screens where it was tightest.
- Autocapitalize, autocorrect, and predictive text are suppressible by attribute; they were a real cost but a payable one.

**Bad**

- **The per-platform hack is now ours to maintain.** That was the strongest argument against this, and it does not stop being true because the playtest went the other way. It is a cost accepted with eyes open, not one that was disproved.
- `visualViewport` is the only way to know how tall the keyboard is, and it is the one piece of this with no reasonable fallback. Where it is missing, the bar sits at the bottom of the layout viewport and may be covered.
- **Shift stops being a usable rebus signal on mobile**, because a phone's shift key produces an uppercase letter and nothing else. The Rebus toggle in the pinned bar becomes the only mobile path to a rebus square; Shift survives on desktop only.
- Clearing a multi-letter rebus is now one press per letter rather than one press. Backspace peels a letter at a time, which is the correction a player usually means, but there is no longer a single "empty this square" key on a phone.
- iOS zooms the page when focusing an input whose font-size is below 16px, so the hidden input carries a size it never displays.
- Moving key handling off the grid and onto the input touches arrow keys, Tab, Space, and Backspace as well as letters — the whole of `<pt-crossword-board>`'s navigation, not just its text entry.
- **Turning the cursor around has no button on a touch screen at all.** Re-tapping the square is the convention and it is discoverable to anyone who has used a crossword app before, but it is a gesture rather than a control, and someone who has not will not find it by looking. This is the weakest part of the decision and the one most likely to come back from the next playtest.
- Backspace is read from `keydown` as well as from `beforeinput`. The input is kept empty and an empty input has nothing to delete, so browsers disagree about whether a `deleteContentBackward` is raised at all — a named `Backspace` key is unambiguous wherever one arrives, and taking it suppresses the input event that would otherwise run the handler twice. So the "single source of key events" above is true of letters and not quite true of deletion.

## Alternatives rejected

**Keep the pad.** The evidence is against it and the evidence is the only thing that was ever going to settle this. Preserving it because the reasoning was good would be preferring the argument to the answer.

**Ship both — native on touch, the pad on desktop.** Two input paths to keep in step, which is precisely what the one-input-path rule exists to prevent, and it doubles the surface for exactly zero benefit: desktop already has a physical keyboard.

**Make the grid `contenteditable` instead of using a hidden input.** Summons the keyboard without an extra element, and hands over control of the DOM to the browser's editing model — IME composition, selection, and paste all land inside the grid. Strictly worse than an input we can keep empty and ignore.

**Keep Erase in the pinned bar alongside ⌫.** Two controls, one gesture, different names — the same objection §4 raised when nonogram wanted an Erase button beside its erase brush.
