# PuzzleTogether — Visual Identity

> Companion to [design-spec.md](design-spec.md). Layout of record: [`pt_game_mock.png`](pt_game_mock.png).
> Implemented as `client/styles/tokens.css`.

## 1. The idea: a printed puzzle page, not a dashboard

The whole brand rests on one metaphor. This is the Sunday puzzle page on good paper — calm, roomy, tactile, quietly playful. The app should feel like something you'd solve with a pencil at a kitchen table, not a productivity tool with a puzzle bolted on.

Three principles fall out of that, and every decision below traces back to one of them:

1. **The grid is the loudest thing on screen.** Every other element is deliberately quiet so the puzzle carries the page. Chrome earns its ink or it goes.
2. **Color belongs to people, not to chrome.** The only saturated elements are player identities and a single accent. No colored buttons, no colored banners, no status color as decoration.
3. **Soft chrome, sharp puzzle.** Softened rectangles for everything human-facing; hard right angles for the grid itself. That contrast — which the mock already has — *is* the identity.

### Banned

These are the standard-SaaS tells. None of them appear in this product:

| Banned | Instead |
|---|---|
| Indigo/violet primary (`#6366f1` and relatives) | A single deepened cyan, used sparingly |
| Gradient heroes | Flat cream paper |
| Glassmorphism, backdrop blur | Opaque surfaces with borders |
| Drop shadows on cards | 1.5px borders; exactly one shadow app-wide |
| Inter, Geist | Fraunces + Karla |
| A different radius per component | One radius for chrome, one for modals, and square for the grid |
| Skeleton shimmer, spinners | Short italic text in `--graphite` |
| Pure `#FFFFFF` / `#000000` | Warm off-white and warm near-black |
| Emoji as UI icons | Text labels, or inline SVG |

---

## 2. Typography

A warm editorial pairing, chosen specifically because neither face reads as a startup landing page.

| Role | Face | Why |
|---|---|---|
| Wordmark, headings | **Fraunces** (variable) | Old-style serif with `SOFT` and `WONK` axes. The wordmark sets `WONK` on for a slightly off-kilter, hand-cut feel. The single biggest anti-generic lever in the system. |
| UI text | **Karla** | Grotesque with idiosyncratic details — that `K`, the curved leg on `R`. Clean at small sizes, never anonymous. |
| Room code, technical | **DM Mono** | The mock already sets the code in mono. DM Mono is light and unfussy rather than terminal-green coder-y. |
| Grid numerals | **Karla 700**, `tabular-nums` | Large, bold, unambiguous. Deliberately *not* a handwriting face — charming for five seconds, illegible forever. The "pencil" idea is carried by the notes' color and weight instead. |

Self-host all three via `@fontsource` (`@fontsource-variable/fraunces`, `@fontsource/karla`, `@fontsource/dm-mono`) — no third-party request, no CDN dependency, no FOUT tied to someone else's uptime.

```css
--font-display: 'Fraunces Variable', Georgia, serif;
--font-ui:      'Karla', system-ui, sans-serif;
--font-mono:    'DM Mono', ui-monospace, monospace;

/* Wordmark only. WONK is what makes it feel hand-cut rather than generic-serif. */
--wordmark-variation: 'SOFT' 40, 'WONK' 1, 'opsz' 84;
```

### Scale

A modest 1.25 ratio. The wordmark is the only genuinely large text on the page — everything else stays close to body size, which is what keeps the grid dominant.

| Token | Size | Use |
|---|---|---|
| `--text-wordmark` | `clamp(1.75rem, 8.5vw, 2.75rem)` | "PuzzleTogether" only |
| `--text-xl` | 1.5rem | Puzzle header, modal title |
| `--text-lg` | 1.25rem | Room code, timer |
| `--text-base` | 1rem | Body, buttons, player names |
| `--text-sm` | 0.8rem | Cage/clue labels, footer |
| `--text-xs` | 0.64rem | Smallest UI text |

Grid content is derived from cell size, not the scale: the value at `55%` of cell height, pencil marks at `26%`. Marks scale with the cell for the same reason values do — a note in a 4×4's large cell and a note in a 9×9's small one should look like the same mark, not the same number of pixels.

**`--text-wordmark` is the one responsive token.** At 2.75rem the wordmark overran a 320px viewport by 15px, and it is the only text in the system wide enough to do that. Clamping it keeps the full size from about 500px up and shrinks it below, rather than being overridden inside a component — where the next person to change the wordmark would not find it.

Line height `1.5` for prose, `1.2` for headings, `1` inside grid cells. Letter-spacing is left alone everywhere except the wordmark (`-0.02em`) and the room code (`0.08em`).

---

## 3. Color

Warm neutrals are what stop this reading as SaaS. **There is no cool gray anywhere in the system.**

### Light — "paper"

```css
--paper:        #FBF8F3;  /* page background — cream, never white */
--paper-raised: #FFFDF9;  /* modals, keypad keys */
--ink:          #1F1D1A;  /* primary text — warm near-black */
--graphite:     #6B6660;  /* secondary text, cell hairlines */
--rule:         #DED7CB;  /* dividers, chip borders */
--accent:       #0E8FA8;  /* the mock's cyan — large text, borders, focus rings */
--accent-text:  #0B7A8F;  /* body-size links and small accent text */
--pencil:       #3767CC;  /* pencil marks only */
--correct:      #2F7A4A;  /* check feedback */
--wrong:        #C4442E;  /* check feedback — warm red, not fire-engine */
```

**Why two accents.** `#0E8FA8` is the mock's cyan and hits **3.6:1** on `--paper` — fine for the wordmark, the room code, focus rings, and borders (all ≥3:1 contexts) but short of the 4.5:1 that body-size text needs. `--accent-text` is the same hue darkened to **4.7:1** for links and small type. Use the right one; don't paper over the difference.

`--pencil` is deliberately bluer than the accent so pencil marks never read as chrome — and it clears 5.0:1, which matters because marks render at `--text-xs`.

### Dark — "evening desk"

Not a gray inversion. The paper metaphor survives into dark as warm charcoal, so it reads as the same product at night rather than a different one.

```css
--paper:        #1A1815;
--paper-raised: #232019;
--ink:          #EDE7DC;
--graphite:     #9A9288;
--rule:         #3A342B;
--accent:       #3FBBD4;
--accent-text:  #3FBBD4;  /* 7.8:1 — one token suffices on dark */
--pencil:       #7FA3E8;
--correct:      #6FBF8B;
--wrong:        #E88A76;
```

### Measured contrast

Computed against each theme's `--paper`:

| Token | Light | Dark |
|---|---|---|
| `--ink` | 16.1:1 | 15.2:1 |
| `--graphite` | 5.4:1 | 5.8:1 |
| `--accent` | 3.6:1 — **large text / UI only** | 7.8:1 |
| `--accent-text` | 4.7:1 | 7.8:1 |
| `--pencil` | 5.0:1 | 7.0:1 |
| `--correct` | 5.0:1 | ≥5:1 |
| `--wrong` | 4.7:1 | ≥5:1 |

### Player palette

Eight identities, extending the mock's crimson / magenta / orange / green / teal. **Verified in Phase 1** — every value below clears 4.5:1 against its own theme's `--paper`, asserted by `client/styles/tokens.test.js` on every `npm test`.

```css
/* light — "paper" */
--player-0: #D23434;  --player-1: #AE4B97;
--player-2: #A75D16;  --player-3: #3D7E32;
--player-4: #177C7C;  --player-5: #5B63C4;
--player-6: #7A5AA8;  --player-7: #8A6C24;

/* dark — "evening desk" */
--player-0: #DA5858;  --player-1: #BC63A7;
--player-2: #C9701A;  --player-3: #4B9B3E;
--player-4: #1D9A9A;  --player-5: #757CCD;
--player-6: #9176B7;  --player-7: #A8842C;
```

Assigned by lowest free index on join, released on leave, and **changeable by that player from their own chip** — the palette opens under the roster with the colours other people hold shown but unpickable. The server hands out a `colorIndex`, never a hex — the theme decides the value, which is why one index can carry two colours.

> **The palette is per theme, unlike every other token pair.** The original single set failed: measured on cream, the eight candidates ranged 3.2:1 to 5.1:1 and five were short of AA. Darkening them to pass on cream then pushed them *below* AA on charcoal — a colour dark enough to read on paper is too dark to read on an evening desk. Splitting per theme keeps all eight hues; only lightness moves between them, so identities stay recognisable when someone switches theme mid-solve.

Three hard rules regardless of the values:

- **Color is never the only channel.** A name always accompanies it. Presence dots reveal names on hover and focus, and every swatch in the picker is labelled with its colour's name.
- **Player color never tints puzzle content.** Entered digits are always `--ink`. Attribution lives in chips and presence dots, nowhere else.
- **No two players in a room share a colour.** Enforced on the server, not by the picker's disabled swatches — a presence dot is the one place identity is carried by hue with no name beside it, so two players on one colour would make the grid ambiguous. A colour already held is shown greyed *and* struck through: dimming alone is easy to miss on a saturated swatch, and the same rule applies here as everywhere else — never one channel.

---

## 4. Shape, line, and texture

### Radius

```css
--radius-control: 6px;    /* chips, buttons, inputs, switches — everything human-facing */
--radius-grid:    0;      /* the grid and every cell */
--radius-modal:   12px;   /* modals only */
--radius-round:   999px;  /* things that are actually round: presence dots, a switch track */
```

Nothing else gets a radius. The soft-vs-square contrast is load-bearing — it's principle 3 made literal — but it is carried by a *softened rectangle*, not a pill. **Revised in Phase 2**: chrome was originally 999px on everything, and at that radius a row of buttons reads as a row of lozenges floating over the page rather than as a form laid on it. 6px keeps the chrome soft against the grid's hard corners while letting a button still look like a button. `--radius-round` is not a fallback for boxes — the only things allowed to use it are things that are genuinely circular.

### Borders, not shadows

1.5px solid borders throughout. **The only shadow in the entire app** is a single soft one beneath the congrats modal:

```css
--border: 1.5px solid var(--rule);
--shadow-modal: 0 8px 32px rgb(31 29 26 / 0.18);
```

Going shadowless is the strongest anti-SaaS move available and costs nothing.

### Grid line weights carry meaning

```css
--grid-hairline:    1px solid color-mix(in srgb, var(--graphite) 30%, transparent);
--grid-heavy:       2.5px solid var(--ink);   /* the frame's outer edge */
--grid-heavy-width: 2.5px;                    /* region/cage rules, drawn as an overlay */
```

The mock's heavy cage borders are a signature. Keep them emphatic — this is where the grid earns "loudest thing on screen."

**Region rules are an overlay, not a border**, and every cell keeps the same 1px hairlines whatever region it sits in. As a border the heavy rule changed the cell's box, which put rows a pixel out in Firefox, and it mitred with the hairline on the adjoining edge, notching the rule at every crossing. Both are the same lesson: a line that carries meaning should not also carry geometry.

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

It should be invisible until you look for it. This is the detail that makes the page read as *puzzle stationery* rather than *app surface*. If it ever becomes noticeable at a glance, it's too strong — drop the opacity, don't remove the idea.

### Icons

Ten of them, drawn as inline SVG in `client/ui/icons.js`: **erase, undo, pencil (Notes), sun, moon, leave, close (remove a player), check, reveal, puzzles (Puzzle Select)**. Emoji stay banned — they arrive as someone else's artwork at someone else's weight, and they don't recolour. These are line drawings on a 24×24 box that inherit `currentColor` and `--stroke-icon` (1.5, the border weight), so an icon inside a disabled control greys out with it and neither theme needs a second asset.

```css
--stroke-icon: 1.5;   /* the border weight, so icons and rules read as one hand */
```

**An icon never carries meaning alone.** Erase, Undo, Leave room, and the three puzzle actions keep their words; the switch icons repeat a visible label. The one unlabelled icon is the host's remove control, which is why its `aria-label` names the player it would remove. Every icon is `aria-hidden`, because the control around it already has a name. An eleventh should be a decision, not a reflex — the moment there are twenty, the page is a toolbar.

**Two icons that mean different things must look different.** Puzzle Select is a set of four squares, not a back arrow, because Leave room sits a few pixels below it wearing an arrow already — two arrows in a column would say the two buttons do the same thing. Check is a tick rather than a magnifier for the opposite reason: it should look like the ticks and crosses it draws on the cells.

### Controls: buttons versus switches

A **button** says *do this* — Check, Reveal, Start another. A **switch** says *this is how things are* — Notes, Dark theme. The distinction is worth keeping literal: switches are `role="switch"` with the state in the track, so you can read the setting without reading the label, and screen readers announce it as a state rather than an action. Both settle to `--radius-control`; only the track inside a switch is round.

An engaged switch borrows the same 16% accent wash a selected cell uses. It never fills with colour — colour belongs to people (principle 2).

**The state lives in the track and nowhere else.** An engaged switch got an accent border as well, until the obvious happened: an accent frame on a control nobody was focusing read as a stuck focus ring, since accent-on-the-outside means *focused* everywhere else in the app. The knob had already said it. A second channel is worth it when the first is colour alone (see the taken swatches, which are greyed *and* struck); it is a liability when it collides with a meaning the same treatment already carries.

### The focus ring

One ring, everywhere: `2px solid var(--accent)` at `2px` offset (`3px` on the grid, to clear its heavy frame). It lives in `focusRing` in `client/styles/controls.js` and has to be composed into **every shadow root holding something focusable** — the rule in `base.css` reaches the light DOM only, so a component that omits it silently falls back to the browser's ring and the app grows a second focus colour. That is exactly what happened before Phase 2's revision pass.

---

## 5. Motion

Physical and sparse.

| Event | Motion |
|---|---|
| Cell value entered | 90ms scale-pop (`0.85 → 1`), not a fade. It should feel like a mark landing. |
| Presence dot appears | 120ms ease-in fade + scale |
| Modal opens | 160ms fade + 4px rise |
| Switch flips | 90ms slide of the knob, borrowing `--motion-mark`. A switch that teleports reads as a redraw rather than as a thing you moved. |
| Everything else | none |

No page transitions, no spinners, no skeleton shimmer. Loading states are short italic text in `--graphite` ("finding a puzzle…").

All of it sits behind `@media (prefers-reduced-motion: reduce)`, which collapses every duration to `0ms`.

---

## 6. Layout

Centered single column, `max-width: 640px`, everything center-aligned. The mock's whitespace is doing real work — do not compress it.

```css
--space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
--space-4: 1rem;     --space-6: 1.5rem;   --space-8: 2rem;   --space-12: 3rem;
```

Vertical rhythm between major blocks (wordmark → room → players → puzzle header → grid → controls) is `--space-8`, tightening to `--space-4` within a block. The footer sits below a hairline `--rule` at `--space-12`, visually detached.

Mobile: the column is already narrow, so the layout doesn't restructure — it just tightens to `--space-6` between blocks and the grid grows to full width minus `--space-4` gutters.

---

## 7. Verification

Part of the Phase 1 and Phase 2 done-when criteria. All five have now been run:

- **Contrast** ✅ — a script asserts every foreground token clears **4.5:1** against its theme's `--paper`, and every player color clears 4.5:1 on both themes. `--accent` is exempt at 3:1 but is then banned from body-size text by lint rule or review. Runs in `npm test` so the palette can't silently regress.
- **Both themes at 320px and 1440px** ✅ (Phase 2) — no horizontal scroll, no clipped grid, no illegible pairing. The one failure was the wordmark at 320px; see §2.
- **Fonts blocked** ✅ (Phase 2) — the app renders correctly with `.woff`/`.woff2` aborted. No layout shift, no invisible text, no horizontal scroll (`font-display: swap`, real fallback stacks).
- **Grayscale check** ✅ (Phase 2) — the game screen screenshots in grayscale with every player still named. Nothing critical depends on hue.
- **Reduced motion** ✅ — every duration collapses to `0ms` under the media query in `base.css`.

---

## 8. Known risks

- ~~**Fraunces `WONK` and the paper texture are the two elements most likely to divide opinion.**~~ **Settled in Phase 1 on real screens: both kept.** The wordmark reads hand-cut rather than generic-serif, and the texture at 3% is invisible until looked for.
- ~~**The player palette is unverified**~~ **Verified in Phase 1**, at the cost of going per theme (§3). All eight hues survived.
- **The two-accent split is a papercut.** It's easy to reach for `--accent` in body text out of habit. If review catches this repeatedly, collapse to the single darker value and accept a slightly duller wordmark.
- **Givens versus entries are distinguished by weight alone** (700 against 500), because colour is reserved for people. It is a quieter difference than most sudoku apps use; if it reads as too subtle in play, the next lever is size, not colour.
- **Check feedback is the one thing allowed to recolour puzzle content** (`--correct` / `--wrong` on the value). It is transient — any edit to the cell retires the mark — and it is named in the cell's aria-label, so it is never carried by colour alone. If it starts to feel like the grid is scoring you rather than answering you, the lever is duration, not saturation.
