# ADR-0011: Icons in the panel, words in the page

- **Status**: Partly superseded by [ADR-0012](0012-a-label-under-every-icon.md), 2026-08-09, one day later. See Revisions.
- **Date**: 2026-08-09
- **Context**: [brand.md §4](../brand.md#icons), two of whose rules this changes · [design-spec.md §4](../design-spec.md#4-the-game-screen) · [ADR-0010](0010-one-pinned-input-panel.md), which created the crowding this answers

## Context

[ADR-0010](0010-one-pinned-input-panel.md) put every type's controls into one pinned panel and gave the panel a fixed share of a phone screen. That left the button bar overloaded:

| Type | Button bar |
|---|---|
| Sudoku, KenKen | Notes · Erase · Undo |
| Nonogram | Fill · Cross · Erase · Undo |
| Crossword | Rebus · Undo · All clues |

Labelled, at 320px, none of those fit one line. Sudoku's three wrapped to two rows and nonogram's four to two, and each wrap pushed the keys further down a screen whose remaining height is the grid.

Two rules in [brand.md §4](../brand.md#icons) stood against fixing it that way, both written deliberately: **an icon never carries meaning alone**, and **settings are `role="switch"`, actions are buttons**.

Meanwhile the footer had drifted the other way. It held a labelled `Dark theme` switch, a version line, and a GitHub link: three stacked sentences about the app, under a page whose subject is a puzzle, and no way to answer "what is this?" beyond a version number.

## Decision

**Frequency of use decides whether a control keeps its word.**

- **Everything in the input panel is a wordless, 44px-square icon button**, each carrying its name in `aria-label` and `title`.
- **Everything in the puzzle-action row keeps its word.**
- **Settings become `aria-pressed` toggle buttons rather than `role="switch"`.** The pressed state is an accent border and the same 16% accent wash a selected cell carries, which is what the nonogram brush bar has done since Phase 3. `<pt-switch>` had no consumers left and is deleted.
- **Leave Room joins the action row** at the same size as the buttons beside it, marked by a new `--danger` accent rather than by being smaller and set apart.
- **The footer becomes the app's own controls**: theme and About as icon buttons, with GitHub and Report an issue as small links beneath. A new `<pt-about>` dialog absorbs the version line.

### Why the line falls there

The panel's controls are pressed hundreds of times in a puzzle and learned in the first minute. The action row's are pressed once or twice and two are destructive, so by the time you reach for Reveal or Leave Room an unlabelled icon is a guess. Rule 1 was never really about icons; it was about not making somebody guess.

Rule 2 survives in substance. A setting still announces itself as a state, `aria-pressed` is a state, and it still reads as one without reading the label, because the border and the ground both move. What is given up is the sliding knob, which needed a 2.5rem track to make sense of.

## Consequences

**Good**

- One toggle pattern instead of two. Notes, Rebus, the brushes, and the theme share one `iconButton` fragment in `client/styles/controls.js`.
- `<pt-switch>` is gone: 150 lines and a second way of saying "on".
- The footer says what the app is rather than what version it is.
- `--danger` exists as its own token. It matches `--wrong` to the byte today and is deliberately not the same token, because `--wrong` means *this answer is incorrect*, which is grid feedback and transient.

**Bad, and accepted**

- **An unfamiliar icon is a guess on a touch screen.** `title` is the desktop answer and there is no touch equivalent. Mitigated by every panel control being reachable another way, and by the set being eight icons a solver meets on their first puzzle. If a playtest says people cannot find Rebus, the first lever is a short label under the icon rather than a return to the switch.
- **Four labelled buttons do not fit the action row.** With a host's full set they come to ~618px against the board's 480px, so Leave Room wraps to its own line: the same control at the same size inside the same rule, and not literally the same line. Widening the row past the grid it sits under would be worse.
- **The grayscale check now rests on two channels rather than a shape.** A knob survives losing colour outright; a border and a ground are both colour, differing in lightness as well as hue, which is what makes it pass. `tests/game.spec.js` asserts both channels move.
- **`--danger` and `--wrong` will be asked about.** Two tokens with identical values is a thing a reviewer stops on. The answer is role separation and the expectation that one of them moves.

## Alternatives considered

**Keep the labels and let the bar wrap.** The status quo, costing a row of the panel on every phone screen.

**Icon-only everywhere, including Check and Reveal.** Rejected: Reveal is destructive and host-only, and a wordless eye beside a wordless tick is exactly the guess rule 1 was written against.

**Keep `role="switch"` but drop the track and the label.** Rejected for producing two accessibility patterns that look identical on screen, with no visible difference to justify the split. One had to give, and the brushes were there first.

**A collapse handle on the panel** instead of shrinking its contents. Still the answer if 16rem proves too much; orthogonal to this.

## Revisions

| Change | Original | Why | When |
|---|---|---|---|
| Every panel control carries a one-word label under its icon | Wordless 44px icon squares | The icon-only bar was meant to buy a row of vertical space and bought none: the panel's height is set by the rows of keys below the bar, so a shorter bar left a gap. The wrap was a shrink-to-fit layout property, not a labelling one. → [ADR-0012](0012-a-label-under-every-icon.md) | 2026-08-09, one day later |
| The rule becomes: frequency decides size and placement | Frequency decides whether a control keeps its word | A word costs nothing when the layout is right | 2026-08-09 |
| Everything else stands | n/a | `aria-pressed` settings, `--danger` on Leave Room, the footer, and `<pt-about>` were not what failed | n/a |
