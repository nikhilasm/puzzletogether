# ADR-0008: Crossword takes the phone's keyboard, not ours

- **Status**: Superseded by [ADR-0010](0010-one-pinned-input-panel.md) on 2026-08-06
- **Date**: 2026-08-05
- **Context**: [design-spec.md §4](../design-spec.md#the-input-panel) · [TODO.md open questions](../TODO.md#open-questions) · reverses a Phase 4 decision

> **Superseded.** A playtest on a real iPhone found the keyboard itself fine and everything around it unworkable: half of a solver's ordinary actions dismiss it, and a control bar positioned from `visualViewport` lags it. ADR-0010 returns crossword to a pad of ours and pins that pad for every type. What survives is everything below about *what the clue strip does*: it is still `7D` rather than `7 Down`, and pressing it still walks to the next clue in the direction being worked. What did not survive is where the keys come from.

## Context

Phase 4 gave crossword a letter pad of its own, `<pt-letter-pad>`, in the slot the digits and brushes already occupied. Three arguments were made for it, and all three are still true:

- A native keyboard arrives with autocapitalize, autocorrect, and predictive text, all of which fight a grid that wants exactly one letter at a time.
- It takes a share of the viewport the page cannot query reliably or influence at all, which on a 15×15 decides whether the grid is visible.
- Reaching it needs an offscreen `<input>` holding focus, the fragile trick every crossword on the web maintains per platform.

The design recorded this as the wager against the platform, with an explicit instruction to check it against a real thumb early.

**It was checked on 2026-08-05 by two people solving a 15×15, and it lost.** Players want the keyboard they already know. That preference beats all three arguments, because none of them is about what a solver actually experiences: their thumbs know where the letters are, and on our pad they do not.

## Decision

**Remove `<pt-letter-pad>`. Crossword's registry entry returns to `native`.**

- A focused, hidden `<input>` summons the OS keyboard and becomes the **single source of crossword key events on every platform**, desktop included. The grid stops holding focus; `:focus-within` keeps the focus ring where it belongs.
- Keystrokes are read from `beforeinput` / `input` and their `inputType`, not from `keydown`. Android IMEs report `keydown` as keycode 229 with `key: 'Unidentified'`, so a keydown reader works on desktop, appears to work in an emulator, and fails on real phones.
- The clue bar becomes a **pinned bar** above the keyboard, positioned from `visualViewport`, carrying the clue plus **Rebus**, **Undo**, and **All clues** in one row.
- **The clue itself is a next-clue button**, walking the direction being worked (7D to 8D) rather than toggling direction. There is one strip to give away: moving on is what a solver does dozens of times a puzzle, where turning around is what they do when a crossing goes wrong. Turning around is left to re-tapping the square the cursor is on, plus Space and the perpendicular arrow.
- The direction is written **`7D`, not `7 Down`**, because four characters of every entry is a real cost on a phone. The full words stay in the accessible name.
- **Erase is dropped.** It cleared the selected square, and the keyboard's ⌫ is now that key. Same reasoning that dropped Erase from nonogram's brush bar.
- **Undo stays.** Mistyping is exactly when Undo is wanted, so it cannot scroll away behind the keyboard.

## Consequences

**Good**

- Solvers type on the layout their muscle memory already holds, which is the whole of the finding.
- Less UI to build, style, test, and keep aligned with the brand.
- The grid gets back the vertical space the pad occupied.
- Autocapitalize, autocorrect, and predictive text are suppressible by attribute: a real cost but a payable one.

**Bad**

- **The per-platform hack is now ours to maintain.** The strongest argument against this, and it does not stop being true because the playtest went the other way.
- `visualViewport` is the only way to know how tall the keyboard is, and the one piece of this with no reasonable fallback. Where it is missing, the bar may be covered entirely.
- **Shift stops being a usable rebus signal on mobile**, since a phone's shift key produces an uppercase letter and nothing else. The Rebus toggle becomes the only mobile path.
- Clearing a multi-letter rebus is one press per letter.
- iOS zooms the page when focusing an input below 16px, so the hidden input carries a size it never displays.
- Moving key handling off the grid touches arrow keys, Tab, Space, and Backspace as well as letters: the whole of `<pt-crossword-board>`'s navigation. In practice that meant a host-level key listener plus `renderOverlay`, `focusTarget`, and `describeCell` on `<pt-board>`, which is more base-element change than a new type is supposed to need.
- **Turning the cursor around has no button on a touch screen.** Re-tapping is the convention and is discoverable to anyone who has used a crossword app, but someone who has not will not find it by looking. The weakest part of the decision.
- Backspace is read from `keydown` as well as `beforeinput`: the input is kept empty and an empty input has nothing to delete, so browsers disagree about whether `deleteContentBackward` is raised. So "single source of key events" is true of letters and not of deletion.

## Alternatives rejected

**Keep the pad.** The evidence is against it, and the evidence is the only thing that was ever going to settle this.

**Ship both, native on touch and the pad on desktop.** Two input paths to keep in step, which is what the one-input-path rule exists to prevent, for zero benefit: desktop already has a physical keyboard.

**Make the grid `contenteditable`.** Summons the keyboard without an extra element and hands the browser's editing model control of the DOM: IME composition, selection, and paste all land inside the grid. Strictly worse than an input we can keep empty.

**Keep Erase alongside ⌫.** Two controls, one gesture, different names.

## Revisions

| Change | Original | Why | When |
|---|---|---|---|
| Superseded in whole on the source of keys | Crossword typed on the platform keyboard | The keyboard's letters were fine; the screen around them was not. → [ADR-0010](0010-one-pinned-input-panel.md) | 2026-08-06 |
| The clue strip's behaviour survives unchanged | n/a | `7D` and next-clue were about the strip, not about where the keys come from | 2026-08-06 |
| The four `<pt-board>` changes are given back | Host key listener plus `renderOverlay`, `focusTarget`, `describeCell` | They existed only to serve the hidden input | 2026-08-06 |
