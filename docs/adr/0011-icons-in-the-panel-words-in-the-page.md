# ADR-0011 — Icons in the panel, words in the page

- **Status**: **Partly superseded by [ADR-0012](0012-a-label-under-every-icon.md)** (2026-08-09, one day later). The icon-only panel is reversed: it was meant to buy a row of vertical space and bought none, because the panel's height is set by the rows of keys below the button bar. Everything else here stands — `aria-pressed` settings, the `--danger` accent on Leave room, the footer, and `<pt-about>`. The rule stated below, that *frequency decides whether a control keeps its word*, is replaced by ADR-0012's: frequency decides a control's size and placement, and a word costs nothing when the layout is right.
- **Date**: 2026-08-09
- **Context**: [brand.md §4](../brand.md#icons), two of whose rules this changes · [design-spec.md §4](../design-spec.md#4-the-game-screen) · [ADR-0010](0010-one-pinned-input-panel.md), which created the crowding this answers

## Context

[ADR-0010](0010-one-pinned-input-panel.md) put every type's controls into one pinned panel, and gave the panel a fixed share of a phone screen. That was the right move and it left the button bar overloaded. Counting what has to fit on one line above the keys:

| Type | Button bar |
|---|---|
| Sudoku, KenKen | Notes · Erase · Undo |
| Nonogram | Fill · Cross · Erase · Undo |
| Crossword | Rebus · Undo · All clues |

Labelled, at 320px, none of those fit one line. Sudoku's three wrapped to two rows, nonogram's four to two, and each wrap pushed the keys further down a screen whose remaining height is the grid. The panel was spending a row of itself on words that a solver reads twice — once on the first puzzle, and never again.

Two rules in [brand.md §4](../brand.md#icons) stood against fixing it that way, and both were written deliberately:

1. **"An icon never carries meaning alone."** Erase, Undo, Leave room, the three puzzle actions, and the three nonogram brushes were named as keeping their words.
2. **Settings are `role="switch"`, actions are buttons**, kept literal so a setting announces itself as a state rather than an action.

Meanwhile the footer had drifted the other way. It held a labelled `Dark theme` switch, a version line, and a GitHub link — three stacked sentences about the app, under a page whose subject is a puzzle, and no way at all to answer "what is this?" beyond a version number.

## Decision

**Frequency of use decides whether a control keeps its word.**

- **Everything in the input panel is a wordless, 44px-square icon button.** Notes, Rebus, the three brushes, Erase, Undo, All clues, and Backspace. Each carries its name in `aria-label` and in `title`.
- **Everything in the puzzle-action row keeps its word.** Puzzle Select, Check, Reveal, and now Leave room are icon-and-label as before.
- **Settings become `aria-pressed` toggle buttons rather than `role="switch"`.** The pressed state is an accent border and the same 16% accent wash a selected cell carries — which is exactly what the nonogram brush bar has done since Phase 3. `<pt-switch>` had no consumers left and is deleted.
- **Leave room joins the action row** at the same size as the buttons beside it, marked out by a new `--danger` accent rather than by being smaller and set apart.
- **The footer becomes the app's own controls**: a theme toggle and an About button as icon buttons, with GitHub and Report an issue as small links side by side beneath. A new `<pt-about>` dialog absorbs the version line.

### Why the line falls there

The panel's controls are pressed hundreds of times in a puzzle and learned in the first minute. The action row's are pressed once or twice, and two of them are destructive — by the time you reach for Reveal or Leave room, an unlabelled icon is a guess. Rule 1 was never really about icons; it was about not making somebody guess. In the panel, nobody is guessing by the second puzzle, and the row of chrome the words cost is charged against the grid on every screen.

Rule 2 survives in substance. A setting still announces itself as a state — `aria-pressed` is a state — and it still reads as one without reading the label, because the border and the ground both move. What is given up is the sliding knob, which needed a 2.5rem track and a word beside it to make sense of, and which was the entire cost.

## Consequences

**Good**

- The button bar is one row at 320px in every puzzle type. That is a row of the panel given back to the grid on the narrowest screen we support, and it is the whole point.
- One toggle pattern instead of two. Notes, Rebus, the brushes, and the theme are now the same control with different icons, sharing one `iconButton` fragment in `client/styles/controls.js`.
- `<pt-switch>` is gone — 150 lines, and a second way of saying "on".
- The footer says what the app is rather than what version it is.
- `--danger` exists as its own token. It matches `--wrong` to the byte today and is deliberately not the same token: `--wrong` means *this answer is incorrect*, which is grid feedback and transient, and brand.md already refuses it for the caution triangle on those grounds.

**Bad, and accepted**

- **An unfamiliar icon is a guess on a touch screen.** `title` is the desktop answer and there is no touch equivalent. The mitigation is that every panel control is reachable another way — Notes and Rebus have keyboard paths, Erase and Undo are Delete and Ctrl+Z, Backspace is Backspace — and that the set is eight icons a solver meets on their first puzzle. If a playtest says people cannot find Rebus, the first lever is a short label under the icon rather than a return to the switch.
- **Four labelled buttons do not fit the action row.** With a host's full set they come to ~618px against the board's 480px, so Leave room wraps to its own line beneath the other three. It is the same control at the same size inside the same rule, which is what was asked for; it is not literally the same line. Widening the row past the grid it sits under would be a worse answer.
- **The grayscale check now rests on two channels rather than a shape.** A switch showed its state by moving a knob, which survives losing colour outright. A pressed button shows it with a border and a ground, both of which are colour — they differ in lightness as well as hue, which is what makes it pass, but it is a narrower margin than a knob was. `tests/game.spec.js` asserts both channels move.
- **`--danger` and `--wrong` will be asked about.** Two tokens with identical values is a thing a reviewer stops on. The answer is role separation and the expectation that one of them moves; if a year passes and neither has, merging them is a small change.

## Alternatives considered

**Keep the labels and let the bar wrap.** This is the status quo, and it costs a row of the panel on every phone screen — the thing ADR-0010 spent a fixed 16rem to make predictable.

**Icon-only everywhere, including Check and Reveal.** Rejected: Reveal is destructive and host-only, and a wordless eye icon beside a wordless tick is exactly the guess rule 1 was written against. The row is also pressed rarely enough that its words cost nothing.

**Keep `role="switch"` but drop the track and the label.** Considered seriously, and rejected for producing two accessibility patterns that look identical on screen — a `switch` for Notes and Rebus, `aria-pressed` for the brushes right beside them — with no visible difference to justify the split. One of them had to give, and the brushes were there first.

**A collapse handle on the panel** instead of shrinking its contents. Still the answer if 16rem proves too much ([open question 14](../TODO.md#open-questions)); this ADR is orthogonal to it and makes the panel smaller either way.
