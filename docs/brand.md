# PuzzleTogether — Visual Identity

> Companion to [design-spec.md](design-spec.md). Layout of record: [`pt_game_mock.png`](pt_game_mock.png).
> Implemented as `client/styles/tokens.css`.

## 1. The idea: a printed puzzle page, not a dashboard

The whole brand rests on one metaphor. This is the Sunday puzzle page on good paper — calm, roomy, tactile, quietly playful. The app should feel like something you'd solve with a pencil at a kitchen table, not a productivity tool with a puzzle bolted on.

Three principles fall out of that, and every decision below traces back to one of them:

1. **The grid is the loudest thing on screen.** Every other element is deliberately quiet so the puzzle carries the page. Chrome earns its ink or it goes.
2. **Color belongs to people, not to chrome.** The only saturated elements are player identities and a single accent. No colored buttons, no colored banners, no status color as decoration.
3. **Soft chrome, sharp puzzle.** Pills and rounded shapes for everything human-facing; hard right angles for the grid itself. That contrast — which the mock already has — *is* the identity.

### Banned

These are the standard-SaaS tells. None of them appear in this product:

| Banned | Instead |
|---|---|
| Indigo/violet primary (`#6366f1` and relatives) | A single deepened cyan, used sparingly |
| Gradient heroes | Flat cream paper |
| Glassmorphism, backdrop blur | Opaque surfaces with borders |
| Drop shadows on cards | 1.5px borders; exactly one shadow app-wide |
| Inter, Geist | Fraunces + Karla |
| 8px radius on everything | Pills (999px) or square (0). Nothing between, except modals |
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
| `--text-wordmark` | 2.75rem | "PuzzleTogether" only |
| `--text-xl` | 1.5rem | Puzzle header, modal title |
| `--text-lg` | 1.25rem | Room code, timer |
| `--text-base` | 1rem | Body, buttons, player names |
| `--text-sm` | 0.8rem | Cage/clue labels, footer |
| `--text-xs` | 0.64rem | Pencil marks |

Grid digit size is derived from cell size, not the scale: `font-size: 55%` of cell height.

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

Eight identities, extending the mock's crimson / magenta / orange / green / teal:

```css
--player-0: #D64545;  --player-1: #B5539E;
--player-2: #C9701A;  --player-3: #4B9B3E;
--player-4: #1D9A9A;  --player-5: #5B63C4;
--player-6: #7A5AA8;  --player-7: #A8842C;
```

Assigned round-robin on join, released on leave.

> **These are candidate values, not verified ones.** They are tuned by eye for hue separation, including under the common color-vision deficiencies, but several sit near the 4.5:1 line on cream — `#D64545` measures about 4.1:1, which is short for player names at body size. **Phase 1 must run the contrast check in §7 and nudge any failures darker before these ship.** Hue separation is the constraint that must survive the nudging; exact values are not precious.

Two hard rules regardless of the values:

- **Color is never the only channel.** A name always accompanies it. Presence dots reveal names on hover and focus.
- **Player color never tints puzzle content.** Entered digits are always `--ink`. Attribution lives in chips and presence dots, nowhere else.

---

## 4. Shape, line, and texture

### Radius

```css
--radius-pill:  999px;  /* chips, buttons, toggles */
--radius-grid:  0;      /* the grid and every cell */
--radius-modal: 12px;   /* modals only */
```

Nothing else gets a radius. The pill-vs-square contrast is load-bearing — it's principle 3 made literal.

### Borders, not shadows

1.5px solid borders throughout. **The only shadow in the entire app** is a single soft one beneath the congrats modal:

```css
--border: 1.5px solid var(--rule);
--shadow-modal: 0 8px 32px rgb(31 29 26 / 0.18);
```

Going shadowless is the strongest anti-SaaS move available and costs nothing.

### Grid line weights carry meaning

```css
--grid-hairline: 1px solid color-mix(in srgb, var(--graphite) 30%, transparent);
--grid-heavy:    2.5px solid var(--ink);   /* region/cage boundaries, outer edge */
```

The mock's heavy cage borders are a signature. Keep them emphatic — this is where the grid earns "loudest thing on screen."

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

---

## 5. Motion

Physical and sparse.

| Event | Motion |
|---|---|
| Cell value entered | 90ms scale-pop (`0.85 → 1`), not a fade. It should feel like a mark landing. |
| Presence dot appears | 120ms ease-in fade + scale |
| Modal opens | 160ms fade + 4px rise |
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

Part of the Phase 1 done-when criteria:

- **Contrast**: a script asserts every foreground token clears **4.5:1** against its theme's `--paper`, and every player color clears 4.5:1 on both themes. `--accent` is exempt at 3:1 but is then banned from body-size text by lint rule or review. Run it in `npm test` so the palette can't silently regress.
- **Both themes at 320px and 1440px** — no horizontal scroll, no clipped grid, no illegible pairing.
- **Fonts blocked**: the app renders correctly with webfonts disabled. No layout shift, no invisible text (`font-display: swap`, real fallback stacks).
- **Grayscale check**: screenshot the game screen in grayscale. Every player must still be distinguishable by name; nothing critical may depend on hue.
- **Reduced motion**: with the OS setting on, no animation runs.

---

## 8. Known risks

- **Fraunces `WONK` and the paper texture are the two elements most likely to divide opinion.** Both are one-line reversions. Judge them on real screens in Phase 1, not in the abstract.
- **The player palette is unverified** (§3). Contrast fixes may compress hue separation; if eight distinguishable colors can't all clear AA on cream, reduce to six rather than shipping unreadable names.
- **The two-accent split is a papercut.** It's easy to reach for `--accent` in body text out of habit. If review catches this repeatedly, collapse to the single darker value and accept a slightly duller wordmark.
