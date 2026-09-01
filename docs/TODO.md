# PuzzleTogether: Progress

> The first place to look to answer "where are we?" Updated as part of the work it tracks, never reconstructed afterward.
>
> Phases and their done-when criteria come from [design-spec.md §13](design-spec.md#13-phases).

**Current phase**: 5 (hardening)
**Branch**: `feature-puzzletogether`
**Last updated**: 2026-08-27

Legend: `[ ]` pending · `[x]` done · `[~]` in progress · `[!]` blocked · `[-]` deferred

---

## Open

### Phase 5: Hardening

*Done when: CI is green and the production build survives a load test.*

- [ ] Generator invariant tests: 200 puzzles per type, uniqueness plus rating stability
- [ ] Board reducer tests: LWW ordering, sequential ops equal the snapshot
- [ ] Protocol schema tests: malformed payloads rejected, no handler crashes
- [ ] Room lifecycle tests: reconnect, host election, streak rules, GC
- [ ] GitHub Actions CI: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:ui && npm run build`, after `npx playwright install --with-deps chromium firefox`
- [ ] Dockerfile plus `.env.example`
- [ ] Load test: N simulated players in one room
- [ ] README covering local dev and the multi-instance constraint

### Carried open

- [~] **Crossword shipping licence.** Building is unblocked; what may legally ship is not. The tracked bank holds only puzzles whose licence is known. → [ADR-0004](adr/0004-hybrid-puzzle-supply.md)
- [ ] **Attribution lens** (`<pt-attribution-layer>`): designed, tabled before implementation. Needs three checks before acceptance: measure the layer at 25×25, look at a finished nonogram with it on, play a crossword with it. → [ADR-0013](adr/0013-attribution-is-a-lens.md)
- [-] **Panel collapse handle.** The lever if 16rem proves too much. Not built: a state a player can be stuck in and a control to explain.

### Open questions

| # | Question | Needed by | Status |
|---|---|---|---|
| 12 | Is 8 the right rebus ceiling, and will review hold the per-type value bound? | Phase 5 | Open. 8 holds every rebus in ordinary use, but `schema.js` no longer stops a type accepting a long value, so a fifth type that forgets gets a bug. → [ADR-0007](adr/0007-rebus-widens-the-cell-value.md) |
| 13 | Turning the cursor around has no button on a touch screen. Is re-tapping enough? | next playtest | Open, unchanged by the 4b rework. Re-tap plus Space plus the perpendicular arrow. Discoverable to anyone who has used a crossword app, invisible to anyone who has not. |
| 14 | Is ~16rem of a phone screen too much for the input panel? | next playtest | Open. More than the platform keyboard and its one-row bar took, and a number we chose. A collapse handle is the next lever. |
| 16 | Does the attribution lens hiding the cursor make it a lens or make it useless? | before ADR-0013 is accepted | Open, and the thing most likely to come back from a playtest. |

**Resolved**: 16 kakuro generation (2026-08-30: rebuilt to choose clue values rather than derive them from a filled grid, [ADR-0015](adr/0015-kakuro-clues-are-chosen-not-derived.md). Runs average 4.0-4.2 squares at 11×11 and 13×13 against 2.5 before; open squares per puzzle 26-118 against 24-86; no printed digits in 120 puzzles, against 0.5-7 each. Median 1-815ms, worst 2.0s at a 13×13, inside a pool refill. 114 of 120 landed on the difficulty requested. Layouts then redrawn as a symmetric clustered pattern at a per-difficulty density, [ADR-0016](adr/0016-kakuro-blocks-are-a-pattern.md): 203 of 240 exactly symmetric, density 21-33% against 17-30% scattered, runs 3.5 at medium against 4.0, hard 13×13 down to 197ms from 1052ms, 177 of 192 on the difficulty requested as a single draw, with the pool now redrawing the rest, [ADR-0017](adr/0017-the-pool-redraws-for-difficulty.md)) · 1 licensing (split, 2026-08-03: building unblocked, shipping open) · 2 Fraunces `WONK` (keep) · 3 paper texture (keep at 3%) · 4 player palette (8 survive, per theme) · 5 LWW (feels fine, 2026-08-05) · 6 Lit at 25×25 (19ms first render, 2.9ms median per-cell update) · 7 KenKen at 7×7 (~170ms median / 870ms worst, inside a pool refill) · 8 sudoku difficulty targeting (`DIFFICULTY_MIN_SIDE` disables the picker below 9×9; ~1% miss stands at 9×9, closed by the pool redrawing a puzzle that rates off the band asked for) · 9 undo (no surprise, 2026-08-05) · 10 clue lists behind a button (right, 2026-08-05) · 11 our pad versus the phone's keyboard (pad, in QWERTY, pinned) · 15 unlabelled panel controls (withdrawn; every control has its word).

---

## Phase 0: Documentation

*Done when: `docs/` is merged on `feature-puzzletogether` and reviewed.*

- [x] `design-spec.md`, `brand.md`, `architecture.md` (6 Mermaid diagrams), `code-style.md`, `TODO.md`
- [x] ADR-0001 through ADR-0006
- [x] Reviewed and merged: `9729cb5 Add docs for impl`

---

## Phase 1: Vertical slice

*Done when: two browsers in one room edit the same sudoku live with visible presence, one refreshes mid-solve and returns with name/colour/host intact, and completing the grid triggers solve detection.*

**Scaffold**

- [x] Prototype `html/`, `css/`, `js/` deleted; `jquery`, `bootstrap`, `nodemon` dropped
- [x] Vite + Lit + Express + Socket.IO; dev proxy 5173 → 3001, target follows `PORT`
- [x] `jsconfig.json` with `checkJs`, ESLint flat config, Prettier
- [x] Brand tokens in `client/styles/tokens.css`; self-hosted fonts via `@fontsource`

**Shared**

- [x] `protocol.js`, `schema.js`, `board-reducer.js`, `constants.js`, `puzzle-doc.js`

**Rooms**

- [x] 4-char lowercase codes with correct collision checking
- [x] Reconnect tokens: issue, `localStorage`, handshake auth, identity restore
- [x] ~2 min disconnect grace with dimmed chips
- [x] Host election plus server-side authorization on every host-only event
- [x] Room GC sweep, all timers cleared on delete
- [x] Token-bucket rate limiting on ops and focus

**Sudoku**

- [x] Seeded generator, uniqueness-checking counting solver, technique-based difficulty rating
- [x] `provider.js` seam plus `pool.js` pre-warm in `worker_threads`
- [x] Module interface: `create` / `validateOp` / `isComplete` / `checkCells`

**Client**

- [x] `RoomStore` plus selector-based `StoreController`
- [x] `<pt-app>` hash router; landing, create, join
- [x] Mock layout: wordmark, room code, chips with host ★, puzzle header, timer
- [x] `<pt-board>` base plus `<pt-sudoku-board>`; `<pt-cell>` keyed single render
- [x] Optimistic ops, echo reconcile, `seq` gap → `sync:request` → snapshot
- [x] Server-verified solve detection
- [-] Puzzle Select stubbed as a host-only "Start Sudoku" button, deferred to Phase 2; it already emits the final `game:start` payload

**Tests and verification**

- [x] `board-reducer.test.js`, `schema.test.js`, `sudoku.test.js`, `tokens.test.js` (contrast gate)
- [x] Two browsers, same cell: LWW resolves identically in both
- [x] Hard refresh mid-solve restores identity, colour, host, board, timer
- [x] No socket frame contains solution values
- [x] 25×25 renders and updates smoothly: 19ms first render, 2.9ms median per-cell, 1.7ms presence
- [x] Room GC and host re-election confirmed with shortened timings

---

## Phase 2: The full game screen

*Done when: a full session is playable on a phone without touching the console, and the streak increments and resets per [design-spec.md §4](design-spec.md#4-the-game-screen).*

**Screens and controls**

- [x] Puzzle Select via `<pt-puzzle-picker>`, shared with the congrats modal
- [x] On-screen keypad sized to the alphabet, shared input path, dims exhausted digits
- [x] Notes mode plus pencil marks (`marks` op, `--pencil`, fixed slot per digit)
- [x] `Check` RPC broadcast to the room; `Reveal` RPC behind a confirm dialog
- [x] Per-room assist counter, shown on the screen and in the modal, survives a refresh
- [x] Per-player forward-only undo (`UndoStack`), skipped with a notice when the cell has moved on
- [x] Congrats modal with time, streak, assists; host-only new-puzzle controls
- [x] Host-only Back to Puzzle Select; streak rules in `server/rooms/progress.js`
- [x] Dark theme with an inline bootstrap so dark never flashes cream
- [x] Mobile layout, touch input, accessibility pass, grayscale check

**Revision pass on the built UI**

- [x] Chrome radius 999px → 6px; grid keeps its sharp corners
- [x] One focus ring, as a `focusRing` fragment composed into every shadow root that needs it
- [x] `client/ui/icons.js` as inline SVG on `currentColor`
- [x] Notes moves above the keypad, over the keys whose meaning it changes

**Room and landing pass**

- [x] `player:color`: a player picks their own colour from their chip; the server enforces uniqueness
- [x] `Leave room` on Puzzle Select and on the game screen; leaving is what navigating away means
- [x] Landing becomes `Create` / `Join` tabs over one form, text over a rule
- [x] `room:kick` behind a confirm dialog; the removed player is told before the seat is dropped
- [x] `you` on your own chip, `x/n` above the roster; taken colours greyed **and** struck through
- [x] Chips and cells are one box each (`box-sizing` inside the shadow root)
- [x] Both grid axes declared in the mark grid and the presence layer

**Verification**

- [x] Socket harness, 31 checks; two-browser session, 41 checks
- [x] 320px phone emulation, grayscale, fonts blocked, dark theme at 320px and 1440px
- [x] Browser suite made permanent in `tests/`: 82 checks in Chromium and Firefox

---

## Phase 3: Nonogram + KenKen

*Done when: both are playable and adding them required no changes to `shared/` or `<pt-board>`.*

**KenKen**

- [x] Generator: Latin square → cage partition → op assignment → uniqueness check, with cage splitting so generation is total
- [x] `<pt-kenken-board>`: cage rules and labels. 40 lines, no `<pt-board>` change
- [x] Sizes 4–7; difficulty as a generation parameter
- [x] Cage clues take a row of the mark grid (`reservesLabelRow`) and are sized by that row
- [x] Cage clues are spoken as arithmetic via `spokenLabel`; a blocked square says "blocked"

**Nonogram**

- [x] Generator: bitmap → line-solver uniqueness rejection; difficulty measured from the same solver
- [x] `<pt-nonogram-board>`: clue gutters, tri-state cells, five-square counting bands
- [x] Drag-fill batched into one `fill` op, axis-locked, one Undo per stroke, released on the window
- [x] The run washes in the accent as the drag covers it (`isHighlighted`)
- [x] Filled squares take the whole cell; crosses sized to the square
- [x] 20×20 kept, with a warning triangle in Puzzle Select and a line saying why
- [x] Brush tri-toggle replaces Notes and the digits; Undo stays

**Seams**

- [x] `client/boards/registry.js`: board element and input style per type
- [x] `server/puzzles/value-grid.js` shared by sudoku and kenken
- [x] `DIFFICULTY_MIN_SIDE` becomes per type
- [x] Confirmed: `shared/` needed no logic changes

**Verification**

- [x] `kenken.test.js`, `nonogram.test.js`, `tests/puzzle-types.spec.js`
- [x] Full gate: 181 unit tests, lint, typecheck, Prettier, build, 128 browser checks
- [x] 20×20 at 320px: no horizontal scroll, square frame, 44px brush targets

---

## Phase 4: Crossword + bank

*Done when: a 15×15 is co-op solvable with synchronized clue-list state.*

**Shared** (the one place this phase touches it)

- [x] `MAX_CELL_VALUE_LENGTH = 8`; `cellValue()` accepts 1–8
- [x] Sudoku and kenken value gates become character-set tests, not `String.includes`
- [x] `PUZZLE_TYPES` / `PUZZLE_TYPE_NAMES` / `DIFFICULTY_MIN_SIDE` gain `crossword`

**Bank and importer**

- [x] Bank file holds the finished doc plus its solution; the loader validates, it does not compile
- [x] `numberGrid()` used by the importer to produce and by the loader to check
- [x] `index.json` manifest with `license`; `BankProvider` plus boot-time validation
- [x] `scripts/import-crossword.js`: `.puz` and `.ipuz` readers, carrying `GRBS`/`RTBL` and `GEXT`, ignoring `LTIM`/`RUSR`
- [x] Refusals by name and reason: scrambled, past 25×25, rebus past 8, numbering mismatch
- [x] `--license` is a required argument
- [x] Hand-authored seed minis

**Server**

- [x] `crossword/index.js`: three methods, no `create`; `isComplete` and `checkCells` are the shared value-grid pair
- [x] `provider.catalog()` on the join ack; a type with nothing behind it is not offered
- [x] Catalog carries `{ rows, cols }` pairs for crossword
- [x] A room does not serve the same banked puzzle twice running
- [-] `checkCellsByValue` skipping blocks: not needed. `checkPuzzle` already passes `editableIndices(doc)`

**Client**

- [x] `<pt-crossword-board>`: black squares, entry numbers, entry highlighting
- [x] `client/boards/crossword-entries.js`: cell → entry index, built once per doc
- [x] `<pt-board>` gains `nextSelection`, `advanceAfterInput`, `isCircled`; `spokenLabel` gains the cell index; a blocked square is never selected
- [x] `<pt-cell>`: value sizes to fit 2–5 characters then holds, full string in `aria-label`; `?circled` draws a ring
- [x] Navigation per §4: step-over, stop at end of entry, click-to-flip, Tab by clue, arrows across flip
- [x] `<pt-clue-bar>`, `<pt-clue-list>` dialog, Rebus toggle
- [x] Puzzle Select reads the catalog rather than `SIZES_BY_TYPE` for crossword

**Verification**

- [x] `crossword.test.js`, `import-crossword.test.js` (`.puz` built byte by byte), `bank.test.js`, `tests/crossword.spec.js`
- [x] 320px: 15×15 with no horizontal overflow, 19px squares
- [x] A rebus square holds a word, shrinks to fit, and peels back one letter at a time
- [x] No socket frame carries solution letters, automated and verified against a deliberately leaked snapshot
- [x] Full gate: 231 unit tests, 162 browser checks
- [x] **A 15×15 solved end to end by two people, 2026-08-05.** Not in the automated suite: the only 15×15 available sits in the gitignored local bank

### Phase 4a: first playtest revisions (2026-08-05)

- [x] LWW, per-player undo, and the clue dialog all hold. Three reserved fallbacks are now not to be built: the soft-lock, all-or-nothing undo, and the desktop clue side panel
- [x] Crossword moves to the platform keyboard through a hidden input → [ADR-0008](adr/0008-native-keyboard-for-crossword.md), later reversed
- [x] Puzzle Select shows a banked type as a list of cards → [ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)
- [x] Clue strip press becomes *next clue*; direction written `7D`
- [x] Cursor and entry washes pulled apart to 62% / 13%
- [x] Typing steps over filled crossings; Backspace clears and steps back
- [x] Cell label sized off `--cell-size`, floored at 7px

### Phase 4b: the input panel (2026-08-06)

*The second playtest, on an iPhone, reversed the largest decision of 4a.* → [ADR-0010](adr/0010-one-pinned-input-panel.md)

- [x] Crossword returns to a pad of ours, QWERTY; registry `native` → `letters`
- [x] `<pt-keypad>` becomes the pinned panel for every type: clue slot, button bar, keys, with `env(safe-area-inset-bottom)`
- [x] Everything acting on a square moves into the panel; everything acting on the puzzle stays down the page
- [x] `<pt-clue-bar>` loses its fixed positioning, its `visualViewport` listener, and its tool buttons
- [x] `<pt-app>` reserves the panel's measured height after the footer
- [x] Every panel control suppresses focus on `pointerdown`
- [x] All four of 4a's `<pt-board>` changes given back; keys read on `.grid` again
- [x] Gone with them: the hidden input, the `beforeinput` reader, the Android IME workaround, the iOS 16px rule, `#shiftDown`

**Filtering the bank** (2026-08-07)

- [x] Size and difficulty filter rows, each drawn only where the bank has more than one value
- [x] An option that would empty the list is disabled, which is what makes an empty list unreachable
- [x] Filtering the chosen card away moves the selection and announces it
- [x] `Choose a puzzle · 2 of 12` while a filter is on
- [x] The card states its difficulty
- [x] `PT_BANK_DIRS` pins the bank the browser suite reads to the tracked directory

**Presence and player colour** (2026-08-07)

- [x] Presence becomes a segmented stripe on the cell's bottom edge, thickness from `--cell-size` clamped to 3–6px
- [x] Two more player colours, sky and grey: ten against eight seats
- [x] Your own cursor is drawn in your own colour via `--focus-color`
- [x] Sudoku and kenken highlight the cursor's row and column; `[highlighted]` is `:not([selected])` in the base element
- [x] Room code, seat count, and roster become one panel: a rule, not a filled box, `--space-4` above the grid
- [-] A colour bar down each chip's leading edge: tried and reverted
- [x] Known and accepted: on a nonogram's filled square the stripe reads at about 3.5:1

**Icons, labels, and the footer** (2026-08-09) → [ADR-0011](adr/0011-icons-in-the-panel-words-in-the-page.md), [ADR-0012](adr/0012-a-label-under-every-icon.md)

- [x] Settings become `aria-pressed` icon buttons sharing one `iconButton` fragment; `<pt-switch>` deleted
- [x] Every panel control carries a one-word label under its icon; `flex: 1 1 0` so they share the row
- [x] `<pt-mode-toggle>` and `<pt-brush-bar>` become `display: contents`
- [x] Panel icons fixed at `1rem` rather than `1.25em`
- [x] Crossword's Backspace moves from the pad to the button bar; Clues leads the row
- [x] `Leave Room` joins the action row at full size in `--danger`; `--danger` added to the contrast gate
- [x] The theme control becomes an action that names its destination
- [x] Footer: theme and About as icon buttons over GitHub and Report an issue as links; `<pt-about>` absorbs the version line
- [x] `ISSUES_URL` derived from `GITHUB_URL`

**Visual fixes found in play** (2026-08-09)

- [x] Letter rows become flex, so A and Z are full width and the short rows centre
- [x] Board columns become `minmax(0, 1fr)` and `.value` gets `min-width: 0`, so an eight-character rebus no longer bends the grid
- [x] Sudoku givens read as printed: 700 weight on a `--given-fill` ground mixed from `--ink`
- [x] Congrats modal gets `--motion-celebrate`; its three buttons are one row with icons
- [x] Clue dialog padding fixed: it asked for a `--space-5` that does not exist
- [-] Karla 800 for givens: added and reverted the same day
- [x] `client/css-templates.test.js`: the backtick trap is finally a check

**The grid celebrates a solve**

- [x] A wave of colour crosses the finished grid before the modal opens, delayed by `row + col`, sweep divided by the grid's span so any size takes 1.5s
- [x] The cursor's washes stand down while it runs, withheld at `?selected` and `?highlighted`
- [x] `<pt-celebration-layer>`, mounted for the wave and removed, so mounting is the trigger
- [x] A reveal never celebrates; `celebrates(idx)` lets a board skip squares
- [x] Reduced motion skips the wave outright rather than running it at 0ms

**Verification**

- [x] Full gate: 267 unit tests, lint, typecheck, Prettier, build, 244 browser checks in Chromium and Firefox

---

## Design decisions

Product and visual reversals live in [design-spec.md §16](design-spec.md#16-design-decisions) and [brand.md §9](brand.md#9-design-decisions). What follows is what execution itself decided.

| Decision | Original plan | Why it changed | When |
|---|---|---|---|
| ESLint and typecheck cover `shared/` only, later plus `tests/` and `scripts/` | Repo-wide | `checkJs` over application code was noise about DOM narrowing and Lit typings; the desync risk is confined to the contract | Phase 1, 2026-08-02 |
| Prettier ignores Markdown | Prettier ran repo-wide | It reflowed prose and re-laid-out tables | Phase 2 |
| The browser suite is permanent, in Chromium **and** Firefox | A one-off manual revision pass | Every visual bug was found by a person looking at the screen, and three were invisible to any unit assertion. The cell-alignment bug did not reproduce in Chromium at all | Phase 2 |
| Playwright never reuses a running server | Reuse allowed | The `webServer` command builds, so reuse tests a stale bundle. A leftover process turned a green suite into 21 identical failures | Phase 3 |
| The player palette is per theme | One shared set of eight | No single set clears 4.5:1 on both cream and charcoal | Phase 1 |
| Puzzle Select shipped in Phase 2 | Planned for Phase 1 | Deferred deliberately; the Phase 1 stub already emitted the final `game:start` payload | Phase 1 |
| `PT_BANK_DIRS` pins the bank under test | Tests read the default bank list | The second bank directory is a scratch space, so bank assertions passed or failed on which `.puz` files the developer last imported | Phase 4b, 2026-08-07 |
| The backtick trap is a unit test (`css-templates.test.js`) | Remember not to do it, then a manual import check, then a scratchpad scanner | Eight build failures across four phases, and once the build passed and every browser test failed on an error pointing nowhere near the CSS | Phase 4b, 2026-08-09 |

Three implementation traps that cost time and are now written into [code-style.md](code-style.md) and the CLAUDE.md trap list: a shadow root does not inherit the `box-sizing` reset; `display: contents` on a wrapper component is load-bearing and fails quietly; and a store slice nothing selects does not exist, so the screen lags one interaction behind.
