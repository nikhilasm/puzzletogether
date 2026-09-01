# PuzzleTogether: Visual Identity

> Companion to [design-spec.md](design-spec.md). Layout of record: `pt_game_mock.png`, no longer tracked; it is in git history at `9729cb5`.
> Implemented as `client/styles/tokens.css`.

## 1. The idea: a printed puzzle page, not a dashboard

The Sunday puzzle page on good paper: calm, roomy, tactile, quietly playful. Something you would solve with a pencil at a kitchen table, not a productivity tool with a puzzle bolted on.

Three principles follow, and every decision below traces to one:

1. **The grid is the loudest thing on screen.** Everything else is deliberately quiet. Chrome earns its ink or it goes.
2. **Color belongs to people, not to chrome.** The only saturated elements are player identities and a single accent.
3. **Soft chrome, sharp puzzle.** Softened rectangles for everything human-facing, hard right angles for the grid. That contrast is the identity.

### Banned

| Banned | Instead |
|---|---|
| Indigo/violet primary (`#6366f1` and relatives) | A single deepened cyan, used sparingly |
| Gradient heroes | Flat cream paper |
| Glassmorphism, backdrop blur | Opaque surfaces with borders |
| Drop shadows on cards | 1.5px borders; exactly one shadow app-wide |
| Inter, Geist | Fraunces + Karla |
| A different radius per component | One radius for chrome, one for modals, square for the grid |
| Skeleton shimmer, spinners | Short italic text in `--graphite` |
| Pure `#FFFFFF` / `#000000` | Warm off-white and warm near-black |
| Emoji as UI icons | Text labels, or inline SVG |

---

## 2. Typography

| Role | Face | Why |
|---|---|---|
| Wordmark, headings | **Fraunces** (variable) | Old-style serif with `SOFT` and `WONK` axes. The wordmark sets `WONK` on for a hand-cut feel. The biggest anti-generic lever in the system. |
| UI text | **Karla** | Grotesque with idiosyncratic details. Clean at small sizes, never anonymous. |
| Room code, technical | **DM Mono** | Light and unfussy rather than terminal-green. |
| Grid numerals | **Karla 400 / 700**, `tabular-nums` | Large, unambiguous. Deliberately not a handwriting face: charming for five seconds, illegible forever. The pencil idea is carried by the notes' color and weight. |

Self-hosted via `@fontsource` (`@fontsource-variable/fraunces`, `@fontsource/karla`, `@fontsource/dm-mono`). No third-party request, no CDN dependency.

```css
--font-display: 'Fraunces Variable', Georgia, serif;
--font-ui:      'Karla', system-ui, sans-serif;
--font-mono:    'DM Mono', ui-monospace, monospace;

/* Wordmark only. WONK is what makes it feel hand-cut rather than generic-serif. */
--wordmark-variation: 'SOFT' 40, 'WONK' 1, 'opsz' 84;
```

### Scale

A 1.25 ratio. The wordmark is the only genuinely large text on the page.

| Token | Size | Use |
|---|---|---|
| `--text-wordmark` | `clamp(1.75rem, 8.5vw, 2.75rem)` | "PuzzleTogether" only |
| `--text-xl` | 1.5rem | Puzzle header, modal title |
| `--text-lg` | 1.25rem | Room code, timer |
| `--text-base` | 1rem | Body, buttons, player names |
| `--text-sm` | 0.8rem | Clue labels in cells with no notes under them, panel labels, footer |
| `--text-xs` | 0.64rem | Smallest UI text; panel labels below 30rem |

**Grid content is derived from cell size, not the scale**: the value at 55% of cell height, pencil marks at 26%. A note in a 4×4's large cell and a note in a 9×9's small one should look like the same mark, not the same number of pixels.

**A cage clue sharing its cell with notes is sized by its row of the mark grid**: 86% of that track, with the marks at 78% of theirs. A clue and the note "1" both belong in the top-left corner, so the clue takes a row and the notes start below it.

**A crossword square's number scales with `--cell-size` too**, floored at 7px so a 25×25 keeps its numbering and capped at `--text-sm`.

**`--text-wordmark` is the one responsive token.** At a flat 2.75rem it overran a 320px viewport by 15px, and it is the only text wide enough to do that. Clamping keeps full size from about 500px up.

Line height `1.5` for prose, `1.2` for headings, `1` inside grid cells. Letter-spacing is left alone except on the wordmark (`-0.02em`) and the room code (`0.08em`).

---

## 3. Color

Warm neutrals are what stop this reading as SaaS. **There is no cool gray anywhere.**

### Light, "paper"

```css
--paper:        #FBF8F3;  /* page background: cream, never white */
--paper-raised: #FFFDF9;  /* modals, keypad keys */
--ink:          #1F1D1A;  /* primary text: warm near-black */
--graphite:     #6B6660;  /* secondary text, cell hairlines */
--rule:         #DED7CB;  /* dividers, chip borders */
--accent:       #0E8FA8;  /* the mock's cyan: large text, borders, focus rings */
--accent-text:  #0B7A8F;  /* body-size links and small accent text */
--pencil:       #3767CC;  /* pencil marks only */
--correct:      #2F7A4A;  /* check feedback */
--wrong:        #C4442E;  /* check feedback: warm red, not fire-engine */
--danger:       #C4442E;  /* a control that takes something away: Leave Room */
```

**Why two accents.** `#0E8FA8` hits 3.6:1 on `--paper`: fine for the wordmark, room code, focus rings, and borders (all ≥3:1 contexts) and short of the 4.5:1 body text needs. `--accent-text` is the same hue at 4.7:1. Use the right one.

`--pencil` is bluer than the accent so marks never read as chrome, and clears 5.0:1, which matters at `--text-xs`.

### Dark, "evening desk"

Not a gray inversion. The paper metaphor survives as warm charcoal.

```css
--paper:        #1A1815;
--paper-raised: #232019;
--ink:          #EDE7DC;
--graphite:     #9A9288;
--rule:         #3A342B;
--accent:       #3FBBD4;
--accent-text:  #3FBBD4;  /* 7.8:1: one token suffices on dark */
--pencil:       #7FA3E8;
--correct:      #6FBF8B;
--wrong:        #E88A76;
--danger:       #E88A76;
```

### Measured contrast

Against each theme's `--paper`:

| Token | Light | Dark |
|---|---|---|
| `--ink` | 16.1:1 | 15.2:1 |
| `--graphite` | 5.4:1 | 5.8:1 |
| `--accent` | 3.6:1, **large text / UI only** | 7.8:1 |
| `--accent-text` | 4.7:1 | 7.8:1 |
| `--pencil` | 5.0:1 | 7.0:1 |
| `--correct` | 5.0:1 | ≥5:1 |
| `--wrong` | 4.7:1 | ≥5:1 |
| `--danger` | 4.7:1 | ≥5:1 |

### Player palette

Ten identities against eight seats, defined **per theme**. Every value clears 4.5:1 against its own theme's `--paper`, asserted by `client/styles/tokens.test.js` on every `npm test`.

```css
/* light: "paper" */
--player-0: #D23434;  --player-1: #AE4B97;
--player-2: #A75D16;  --player-3: #3D7E32;
--player-4: #177C7C;  --player-5: #5B63C4;
--player-6: #7A5AA8;  --player-7: #8A6C24;
--player-8: #2073B0;  --player-9: #676B70;

/* dark: "evening desk" */
--player-0: #DA5858;  --player-1: #BC63A7;
--player-2: #C9701A;  --player-3: #4B9B3E;
--player-4: #1D9A9A;  --player-5: #757CCD;
--player-6: #9176B7;  --player-7: #A8842C;
--player-8: #4FA8DD;  --player-9: #9EA4AB;
```

Ten rather than eight so a full room has something to change to; `MAX_PLAYERS_PER_ROOM` is now a question about how many chips fit the column and nothing else. Per theme because a colour dark enough to read on cream is too dark on charcoal: only lightness moves between the themes, so identities stay recognisable when someone switches mid-solve.

Assigned by lowest free index on join, released on leave, and **changeable by that player from their own chip**. The server hands out a `colorIndex`, never a hex, which is why one index can carry two colours.

Three hard rules:

- **Color is never the only channel.** A presence stripe names its player on hover and focus, a chip is its owner's name, and every swatch in the picker is labelled.
- **Player color never tints puzzle content.** Entered values are `--ink` whoever wrote them. Colour carries a chip's name, a presence stripe, your own cursor wash, and the solve wave: all of them the grid's surface, never a value. A wash says who is looking, which is presence; a coloured digit would say who wrote it, which is attribution. ([ADR-0013](adr/0013-attribution-is-a-lens.md) proposes qualifying this to allow an on-request attribution wash on the surface.)
- **No two players in a room share a colour.** Enforced on the server, not by the picker's disabled swatches, because a presence stripe carries identity by hue with no name beside it. A held colour is shown greyed **and** struck through.

---

## 4. Shape, line, and texture

### Radius

```css
--radius-control: 6px;    /* chips, buttons, inputs: everything human-facing */
--radius-grid:    0;      /* the grid and every cell */
--radius-modal:   12px;   /* modals only */
--radius-round:   999px;  /* things that are actually round: a presence stripe's segments */
```

Nothing else gets a radius. The soft-versus-square contrast is principle 3 made literal, and it is carried by a softened rectangle, not a pill. `--radius-round` is not a fallback for boxes.

### Borders, not shadows

1.5px solid borders throughout. **The only shadow in the app** is beneath the congrats modal:

```css
--border: 1.5px solid var(--rule);
--shadow-modal: 0 8px 32px rgb(31 29 26 / 0.18);
```

### Grid line weights carry meaning

```css
--grid-hairline:    1px solid color-mix(in srgb, var(--graphite) 30%, transparent);
--grid-heavy:       2.5px solid var(--ink);   /* the frame's outer edge */
--grid-heavy-width: 2.5px;                    /* region/cage rules, drawn as an overlay */
```

The mock's heavy cage borders are a signature. Keep them emphatic.

**Region rules are an overlay, not a border**, and every cell keeps the same 1px hairlines whatever region it sits in. As a border the heavy rule changed the cell's box, putting rows a pixel out in Firefox, and it mitred with the hairline on the adjoining edge, notching the rule at every crossing. A line that carries meaning should not also carry geometry.

**Type on ink: the kakuro clue square.** A kakuro prints its two sums on a blocked square, which is `--ink` like every other type's blocks, so both numbers are `--paper` and the diagonal dividing them is `--paper` at 55%. This is the only place in the app where text sits on an ink ground, and it is deliberate rather than incidental: the square *is* the clue, so it is drawn as a filled tile with the puzzle written on it, not as a black square with a label stuck in a corner. The rule is softened because it divides the two sums rather than competing with them ([ADR-0014](adr/0014-a-clue-cell-carries-two-sums.md)).

**Heavy rules are not always `--ink`.** Sudoku's region rules are, because they divide the puzzle into parts that carry a rule. A nonogram's bands divide nothing and exist to be counted against, so they are the hairline's colour at three times its weight; in `--ink` they read as thin filled squares competing with the picture. `--grid-heavy-color` and `--grid-heavy-width` are the per-board override; `--grid-frame-width` is separate, because the outer frame is the puzzle's edge in every type and the gutters align by it.

### Texture

A barely-perceptible graph-paper rule on the page background. No image asset:

```css
body {
  background-color: var(--paper);
  background-image:
    repeating-linear-gradient(to right,  var(--ink) 0 1px, transparent 1px 24px),
    repeating-linear-gradient(to bottom, var(--ink) 0 1px, transparent 1px 24px);
  background-blend-mode: normal;
  opacity: 1;
}
/* the rules themselves ride at ~3% via a masked pseudo-element, so content stays full-opacity */
```

It should be invisible until you look for it. If it becomes noticeable at a glance, drop the opacity, do not remove the idea.

**The grid is opaque.** The texture is the surface the puzzle sits on; through the cells it became a second, unaligned ruling inside the real one. The background sits on the frame, not on each cell, so the selection and stroke washes composite over one flat backdrop.

### Icons

Twenty-one, drawn as inline SVG in `client/ui/icons.js`: erase, undo, pencil (Notes), sun, moon, leave, close, check, reveal, puzzles (Puzzle Select), fill, warning, next, rebus, backspace, list (Clues), info (About), help (How to play), flag (Report an issue), github, start. Line drawings on a 24×24 box inheriting `currentColor` and `--stroke-icon`, so an icon inside a disabled control greys out with it and neither theme needs a second asset.

`github` is the one exception, and the exception is the point: it is a borrowed mark on a 16×16 box, filled rather than stroked, because a logo is recognised before it is read and an outlined approximation of it is only a worse version of somebody else's drawing.

```css
--stroke-icon: 1.5;   /* the border weight, so icons and rules read as one hand */
```

**An icon never carries meaning alone.** Every control in the app has its word. **Frequency decides size and placement, not whether there is a word** ([ADR-0012](adr/0012-a-label-under-every-icon.md)):

- **Pressed constantly**: Notes, Rebus, the three brushes, Erase, Undo, Clues, Backspace. In the pinned panel at thumb size, label **under** the icon. Four of them come to 236px against the 296px a 320px screen has to give. The label is `--text-sm`, stepping to `--text-xs` below 30rem. Their icons are a fixed `1rem` rather than `iconStyle`'s `1.25em`, so they match each other rather than whichever shadow root's font size they inherit.
- **Pressed once or twice**: Puzzle Select, Check, Reveal, Leave Room. Down the page, label beside the icon.
- **Peripheral**: the footer's Theme, About, GitHub, and Report. One bar at the foot of the page, drawn with the panel's own `.action`, label under the icon. Theme's label is its destination ("Dark"), like its name and its glyph; Report's is one word against a fuller `aria-label`, because four labels share a 320px row and "Report" alone does not say what of. Asserted in `tests/game.spec.js`.

Three icons stand alone, and put the meaning entirely in the accessible name: the host's remove control, the warning triangle on a cautioned size, and the `?` on the puzzle header. The last is wordless because a question mark is already a word: it has offered to answer "how does this work" on every interface for thirty years, and a labelled button on the caption would compete with the caption. It is a question mark rather than the ⓘ it used to be because the caption beside it already says what the puzzle *is*; what is still wanted from it is the rules. Borderless and `--graphite` in a 2.25rem box, which is the size a secondary icon-only control takes here, the dialogs' close controls included.

Every icon is `aria-hidden`; the control around it has a name. A twenty-second icon should be a decision, not a reflex.

**A caution is not an error.** The warning triangle marks a choice that works and costs something, so it is `--graphite` like any other note, never `--wrong`, and it never disables what it marks.

**Two icons that mean different things must look different.** Puzzle Select is four squares, not a back arrow, because Leave Room sits in the same row wearing an arrow. Check is a tick rather than a magnifier, so it looks like the ticks and crosses it draws on the cells.

**The one solid icon is the one that draws something solid.** `fill` is a filled square where every other icon is a stroked outline, because the mark it paints is a filled square.

### Marks that are not letters

A nonogram cell holds a filled square or a cross, both borrowing colours the app already uses for those ideas. **A fill is an answer, so it is `--ink`**, the same weight and colour as an entered digit, which is why a solved nonogram reads as a printed image. **A cross is a note about where the picture is not, so it is `--pencil`**, exactly like a pencil mark. Check feedback recolours a filled square the way it recolours a digit.

**A fill takes the whole square.** Adjacent fills meet, so a run reads as one bar the length of its clue, which is what a solver is counting; inset blocks read as separate dots. The hairlines draw over the top, so the grid is still a grid.

**A cross is sized to its square, not to the type scale**, at 0.92 of the cell. At text proportions it read as a small dot in a large empty cell, which is what an unmarked cell looks like from arm's length.

**The accent wash means "what this input is aimed at".** The selected cell carries it at 16% and a drag in progress at 30% across every square covered, deeper because it must stay readable over marks already in the run. Neither is a colour the grid keeps.

Clue gutters are `--graphite` and step down in size with the grid. They state the puzzle rather than being part of the picture.

### Controls: actions, settings, and the one that takes something away

An **action** says *do this*: Check, Reveal, Start another. A **setting** says *this is how things are*: Notes, Rebus, a brush. The distinction is literal in the markup: a setting carries `aria-pressed`, so screen readers announce it as a state. Everything settles to `--radius-control`.

**A setting is a pressed button, not a switch** ([ADR-0011](adr/0011-icons-in-the-panel-words-in-the-page.md)).

**The theme control is neither; it is a plain action.** It does one thing, so it names that thing ("Switch to dark theme") and wears the icon of the theme it would leave you in. That also settles which icon to draw, which as a toggle was genuinely ambiguous.

**The pressed state moves four channels, never a fill.** `border-color: var(--accent)`, the same 16% accent wash a selected cell carries, an icon filled to a 35% accent wash and stroked in `--accent-text`, and a label at `font-weight: 700`. The ground never fills with colour: colour belongs to people.

Four channels rather than one replaces the knob. A knob is a shape change and survives losing colour; a pressed button has only paint, so more than hue has to move. Two of the four are shape outright, which is what carries the grayscale check; `tests/game.spec.js` asserts the border and the ground both move.

The icon fills to a wash rather than flat accent because the set is drawn as outlines: solid, `rebus` closes into a plain blue box and becomes the twin of `fill`. At 35% every interior stroke shows through. `cross` has no interior, so it takes the accent alone.

**Hover rules sit behind `@media (hover: hover)`.** A touch browser emulates hover on whatever was tapped last and holds it, so `.action:hover`'s accent border and darkened label sat on a tapped toggle indefinitely: a pressed button missing only its wash. What answers a tap is `:active`, which the browser clears on release. Focus is not the culprit here; `:focus-visible` does not match a touch activation, and the panel's controls `preventDefault()` on `pointerdown` to keep the grid focused.

**`--danger` is for a control that takes something away**, today Leave Room and nothing else. Outlined like every other button: the red is in the border, the word, and the icon, and the ground stays paper until the pointer is on it.

It is its own token and not `--wrong`, which it currently matches to the byte. `--wrong` means *this answer is incorrect*: grid feedback, transient, and already refused for the caution triangle on those grounds. Keeping them apart costs a line of CSS and means either can move first.

### The focus ring

One ring everywhere: `2px solid var(--accent)` at `2px` offset, `3px` on the grid to clear its heavy frame. It lives in `focusRing` in `client/styles/controls.js` and must be composed into **every shadow root holding something focusable**. The rule in `base.css` reaches the light DOM only, so a component that omits it silently falls back to the browser's ring and the app grows a second focus colour.

---

## 5. Motion

Physical and sparse.

| Event | Motion |
|---|---|
| Cell value entered | 90ms scale-pop (`0.85 → 1`), not a fade. A mark landing. |
| Presence stripe appears | 120ms ease-in fade plus vertical scale, so a player arriving grows into their share of the edge |
| Modal opens | 160ms fade plus 4px rise (`--motion-modal`) |
| The congrats modal opens | 260ms fade, 12px rise, scale from 0.94, on an easing that overshoots (`--motion-celebrate`). **The one arrival allowed to be seen.** Every other modal is an interruption; this one is the room finishing something together. |
| The room solves a puzzle | Every square pulses once, up to 32% of a player's colour and back, as a diagonal wave from the top-left to the bottom-right. 1.5s end to end whatever the grid's size: `--motion-celebrate-sweep` divided by the grid's own span, then `--motion-celebrate-pulse` for the last square. The colours are the room's, cycling by diagonal, so a three-player room sends three bands down the grid. **The congrats modal waits for it.** Three rules keep it honest: a **reveal never celebrates** and its modal says "Revealed"; blocked and already-filled squares sit it out, so a crossword's wave traces the puzzle's shape and a nonogram's runs through the ground around the finished picture; and **the cursor's washes stand down for the duration**. It is a wash over the grid's surface, the channel the cursor already uses, and it leaves nothing behind. |
| A toggle engages | none. A border and a ground change together, and animating a colour swap on a control pressed hundreds of times a puzzle would be noise. |
| Everything else | none |

No page transitions, no spinners, no skeleton shimmer. Loading states are short italic text in `--graphite`.

All of it sits behind `@media (prefers-reduced-motion: reduce)`, which collapses every duration to `0ms`. The solve wave also checks the query in JavaScript and skips itself entirely rather than running at 0ms: collapsing it would leave the pause in front of the modal with nothing in it.

---

## 6. Layout

Centered single column, `max-width: 640px`, everything center-aligned. The mock's whitespace is doing real work.

```css
--space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
--space-4: 1rem;     --space-6: 1.5rem;   --space-8: 2rem;   --space-12: 3rem;
```

The scale runs 1, 2, 3, 4, 6, 8, 12. **There is no `--space-5`.** An undefined custom property with no fallback invalidates the whole declaration at computed-value time, and nothing warns about it; that is how the clue dialog shipped with no padding at all.

Vertical rhythm between major blocks is `--space-8`, tightening to `--space-4` within a block. The room panel sits `--space-4` above the grid. The footer sits below a hairline at `--space-12`.

Mobile: the column is already narrow, so the layout does not restructure. It tightens to `--space-6` between blocks and the grid grows to full width minus `--space-4` gutters.

---

## 7. Verification

All five have been run:

- **Contrast** ✅: a script asserts every foreground token clears 4.5:1 against its theme's `--paper`, and every player color clears 4.5:1 on both themes. `--accent` is exempt at 3:1 and banned from body-size text by review. Runs in `npm test`.
- **Both themes at 320px and 1440px** ✅ (Phase 2): no horizontal scroll, no clipped grid, no illegible pairing.
- **Fonts blocked** ✅ (Phase 2): renders correctly with `.woff`/`.woff2` aborted. No layout shift, no invisible text (`font-display: swap`, real fallback stacks).
- **Grayscale check** ✅ (Phase 2): the game screen screenshots in grayscale with every player still named.
- **Reduced motion** ✅: every duration collapses to `0ms`.

---

## 8. Known risks

- **The two-accent split is a papercut.** It is easy to reach for `--accent` in body text out of habit. If review catches this repeatedly, collapse to the single darker value.
- **Givens versus entries are distinguished by weight and a faint ground, never by colour.** 700 against 400, on `--given-fill`, about 5% of `--ink` mixed from the ink rather than given a per-theme value. The tint is `background-color` and the cursor washes are `background-image`, so a given square in the cursor's row shows both rather than one replacing the other. The lever after this one is size, still not colour.
- **Check feedback is the one thing allowed to recolour puzzle content** (`--correct` / `--wrong` on the value). It is transient, and it is named in the cell's aria-label, so it is never carried by colour alone. If it starts to feel like the grid is scoring you, the lever is duration, not saturation.
- **A presence stripe on a nonogram's filled square reads at about 3.5:1**, since it sits on solid `--ink`. Visible, quieter than on paper. A `--paper` backing would fix it and would leave a pale notch across any washed cell.

---

## 9. Design decisions

| Decision | Original design | Why it changed | When |
|---|---|---|---|
| Chrome radius is 6px (`--radius-control`) | 999px on everything human-facing | At 999px a row of buttons read as lozenges floating over the page rather than a form laid on it | Phase 2 |
| Player palette is per theme | One shared set of eight | Measured on cream, five of eight were short of AA; darkening them to pass pushed them below AA on charcoal | Phase 1 |
| Ten player colours | Eight, exactly `MAX_PLAYERS_PER_ROOM` | A full room had nothing to change to: the picker opened onto eight swatches with seven struck through | Phase 4b, 2026-08-07 |
| Colour is carried by a chip's name alone | A colour bar down each chip's leading edge (built, reverted) | Ten stacked in a two-column grid read as a rack of tabs; the roster is a list of people, not a legend | Phase 4b, 2026-08-07 |
| Presence is a segmented stripe on the cell's bottom edge | Up to three dots in the cell's top-right with a `+n`, at a flat 9px | Drawn in the content area at a size that grew with the room: it covered the top-right pencil mark and ran out of room at four players | Phase 4b, 2026-08-07 |
| Settings are `aria-pressed` buttons; the pressed state moves four channels | `role="switch"` with a sliding knob; state lived in the track and nowhere else | Two accessibility patterns for one idea in the same bar, and the switch needed a 2.5rem track the panel could not spare ([ADR-0011](adr/0011-icons-in-the-panel-words-in-the-page.md)). With the knob gone, paint has to carry what shape used to | Phase 4b, 2026-08-09 |
| A pressed setting gets an accent border | No accent border, because it read as a stuck focus ring | That finding applied to a control that already had a knob saying the same thing; the ground filling at the same time settles the ambiguity | Phase 4b, 2026-08-09 |
| Every panel control carries a label under its icon | Wordless 44px icon squares in the panel | The icon-only bar was meant to buy a row of vertical space and bought none: panel height is set by the key rows below the bar ([ADR-0012](adr/0012-a-label-under-every-icon.md)) | Phase 4b, 2026-08-09 |
| Hover rules sit behind `@media (hover: hover)` | Unguarded `:hover` | A touch browser holds emulated hover on the last-tapped element, leaving an accent border stuck on a toggle | Phase 4b, 2026-08-09 |
| The footer is one bar of four labelled actions | Two wordless 44px squares over a row of links at `--text-xs` | The split said "a button changes the app, a link leaves it" in a difference of *size*, which reads as a difference in importance: two footnotes under two controls nobody could name without hovering. The distinction survives in the markup, where the two that leave are still anchors | Phase 4b, 2026-08-31 |
| The theme control is an action that names its destination | A labelled `role="switch"`, and before that a button whose label changed under you | A toggle made the icon genuinely ambiguous: a sun reads as "you are in light" as easily as "press for light" | Phase 4b, 2026-08-09 |
| Region rules are drawn as an overlay | A heavier border on the cell | As a border it changed the cell's box, misaligning rows by 1px in Firefox, and mitred with the hairline, notching the rule at every crossing | Phase 2 |
| The grid is opaque | The page texture showed through the cells | It read as a second, unaligned ruling inside the real one | Phase 3 |
| Nonogram's counting bands are the hairline's colour at 3× weight | `--ink`, like sudoku's region rules | In ink they read as thin filled squares competing with the picture they exist to help measure | Phase 3 |
| Grid numerals are Karla 400/700 with a `--given-fill` ground | Karla 800 for givens (added and reverted the same day) | A fourth font face bought a difference nobody could point to once the tint was under it; the ground was doing the work | Phase 4b, 2026-08-09 |
