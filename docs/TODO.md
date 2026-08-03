# PuzzleTogether — Progress

> The first place to look to answer "where are we?" Updated **as part of** the work it tracks, never reconstructed afterward.
>
> Phases and their done-when criteria come from [design-spec.md §13](design-spec.md#13-phases).

**Current phase**: 3 — nonogram + kenken
**Branch**: `feature-puzzletogether`
**Last updated**: 2026-08-03

Legend: `[ ]` pending · `[x]` done · `[~]` in progress · `[!]` blocked · `[-]` deferred, with a reason

---

## Phase 0 — Documentation

*Done when: `docs/` is merged on `feature-puzzletogether` and reviewed.*

- [x] `docs/` created, `pt_game_mock.png` moved in
- [x] `design-spec.md` — full spec
- [x] `brand.md` — visual identity, tokens, contrast targets
- [x] `architecture.md` — prose + 6 Mermaid diagrams
- [x] `code-style.md` — formatting, comment/JSDoc rules, naming, enforcement
- [x] ADR-0001 — per-cell LWW shared state
- [x] ADR-0002 — in-memory rooms, no database
- [x] ADR-0003 — Lit + vanilla JS over TypeScript
- [x] ADR-0004 — hybrid puzzle supply
- [x] ADR-0005 — reconnect tokens for identity
- [x] ADR-0006 — JSDoc + checkJs, runtime validation
- [x] `TODO.md` — this file
- [x] Reviewed
- [x] Merged — `9729cb5 Add docs for impl`

---

## Phase 1 — Vertical slice

*Done when: two browsers in one room edit the same sudoku live with visible presence dots, one refreshes mid-solve and returns with name/color/host intact, and completing the grid triggers solve detection.*

**Teardown & scaffold**
- [x] Delete `html/`, `css/`, `js/`, `js/server/answers.json`
- [x] Drop `jquery`, `bootstrap`, `nodemon` from `package.json`
- [x] Vite + Lit + Express + Socket.IO scaffold; dev proxy 5173 → 3000 (proxy target follows `PORT`)
- [x] `jsconfig.json` with `checkJs: true`; `npm run typecheck` — **scoped to `shared/`**, see note below
- [x] ESLint flat config + Prettier — **ESLint scoped to `shared/`**; Prettier repo-wide
- [x] Brand tokens as `client/styles/tokens.css` (dark values staged, no toggle until Phase 2)
- [x] Self-hosted fonts via `@fontsource` (Fraunces variable, Karla 400/700, DM Mono 400)

> **Scope change, 2026-08-02**: type checking and linting cover `shared/` only — the socket
> contract both sides depend on. Application code in `client/` and `server/` is formatted by
> Prettier and covered by tests, not linted. [code-style.md §10](code-style.md#10-enforcement) and
> [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md) are updated to match.

**Shared**
- [x] `shared/protocol.js` — event constants, `PROTOCOL_VERSION`, JSDoc typedefs
- [x] `shared/schema.js` — runtime payload validator
- [x] `shared/board-reducer.js` — `applyOp()`, imported by both sides
- [x] `shared/constants.js` — palette size, limits, timings
- [x] `shared/puzzle-doc.js` — index/coordinate helpers

**Rooms**
- [x] 4-char lowercase room codes with correct collision checking
- [x] Reconnect tokens: issue, `localStorage`, handshake auth, identity restore
- [x] Disconnect grace period (~2 min) with dimmed chips — no more leaked players
- [x] Host election + server-side authorization on every host-only event
- [x] Room GC sweep; all timers cleared on delete
- [x] Rate limiting (token bucket) on ops and focus

**Sudoku**
- [x] Solved-grid generator (randomized backtracking, seeded)
- [x] Uniqueness-checking counting solver (aborts at 2 solutions)
- [x] Difficulty rating via solving techniques — singles / subsets + pointing / beyond
- [x] `puzzles/provider.js` seam + `pool.js` pre-warm in `worker_threads`
- [x] Module interface: `create` / `validateOp` / `isComplete` / `checkCells`

**Client**
- [x] `RoomStore` + `StoreController` (selector-based, so presence traffic re-renders only the board)
- [x] `<pt-app>` hash router; landing / create / join
- [x] Mock layout: wordmark, room code, player chips with host ★, puzzle header, timer
- [x] `<pt-board>` base + `<pt-sudoku-board>`
- [x] `<pt-cell>` with keyed single render; per-cell property updates
- [x] `<pt-presence-layer>` — corner dots, up to 3 then `+n`
- [x] Optimistic ops, echo reconcile, `seq` gap → `sync:request` → snapshot
- [x] Server-verified solve detection
- [-] Puzzle Select screen is a host-only "Start Sudoku" stub — deferred to Phase 2 by decision;
      it already emits the final `game:start` payload

**Tests** (agreed addition to Phase 1; the coverage push stays in Phase 5)
- [x] `shared/board-reducer.test.js` — LWW ordering, order-independence, snapshot equivalence
- [x] `shared/schema.test.js` — malformed payloads rejected
- [x] `server/puzzles/sudoku/sudoku.test.js` — uniqueness, honest labelling, seed reproducibility
- [x] `client/styles/tokens.test.js` — the contrast gate from [brand.md §7](brand.md#7-verification)

**Verify**
- [x] Two browsers edit the same cell — LWW resolves identically in both
- [x] Hard refresh mid-solve restores identity, color, host, board, timer
- [x] No socket frame contains solution values — asserted over every frame received
- [x] 25×25 grid renders and updates smoothly — 19ms first render, 2.9ms median per-cell update,
      1.7ms presence update. ADR-0003's fallback is not needed.
- [x] `--accent` / player-palette contrast script passes — runs in `npm test`
- [x] Room GC and host re-election confirmed with shortened timings
- [x] Fonts-blocked rendering check (brand.md §7) — **run in Phase 2**; no layout shift, no
      invisible text, no horizontal scroll with `.woff`/`.woff2` blocked

> **Deviation from [brand.md §3](brand.md#3-color)**: the player palette is now **per theme**. No
> single set of eight can clear 4.5:1 on both cream and charcoal — a colour dark enough for paper
> is too dark for the evening-desk background. Hue separation survived; only lightness moved.

---

## Phase 2 — The full game screen

*Done when: a full session — create, pick, solve, modal, start another — is playable on a phone without touching the console, and the streak increments and resets per [design-spec.md §4](design-spec.md#4-the-game-screen).*

**Screens and controls**
- [x] Puzzle Select screen (host picks type / difficulty / size) — `<pt-puzzle-picker>`, shared with
      the congrats modal so "start another" offers exactly the same choices
- [x] On-screen keypad, sized to the puzzle alphabet, shared input path; dims exhausted digits
- [x] Notes / Solve mode toggle — shipped as `Notes | Solve` segments, revised to a single switch
- [x] Pencil marks (`marks` op, `--pencil` rendering) — laid out in fixed positions per digit
- [x] `Check` RPC + per-cell result rendering, **broadcast to the whole room**
- [x] `Reveal` RPC + confirm dialog naming the streak consequence
- [x] Assist counter per room — shown on the game screen and in the modal, survives a refresh
- [x] Per-player forward-only undo — `UndoStack`, skipped with a notice when the cell has moved on
- [x] Congrats modal — solve time, streak, assists, dismissable, all players
- [x] Host-only new-puzzle controls in the modal
- [x] Host-only Back to Puzzle Select (abandons puzzle, resets streak)
- [x] Streak increment/reset rules wired and tested — `server/rooms/progress.js`
- [x] Dark theme + persisted toggle, with an inline bootstrap so dark never flashes cream
- [x] Mobile layout and touch input
- [x] Accessibility pass — grid roles, live regions, focus management, reduced motion
- [x] Grayscale check: players distinguishable without hue

> **Undo lives in the keypad row**, beside Erase, rather than beside Check and Reveal. The mock has
> no Undo control at all, and the phase's done-when criterion is a phone session — so it had to be
> reachable by thumb. Putting it with Erase keeps every way of changing a cell in one place.

> **`game:newPuzzle` was folded into `game:start`.** Starting from `select` and starting again from
> `solved` differ in nothing but the state they leave, and design-spec.md §10 is updated to match.
> A second event with identical semantics would only be a second thing to keep in step.

**Tests**
- [x] `client/store/undo-stack.test.js` — ordering, no-op edits, depth limit
- [x] `client/store/ops.test.js` — Notes/Solve branch, mark toggling, undo restoration
- [x] `server/rooms/progress.test.js` — the streak rules, Check being free, Reveal filling the grid
- [x] `client/theme.test.js` — stored choice beats the OS, unknown values ignored
- [x] `shared/board-reducer.test.js` — mark semantics
- [x] `shared/schema.test.js` — the three new events, marks-op bounds

**Verify**
- [x] Socket harness, 31 checks — Check broadcast and assist counting, Reveal host-gating and
      streak reset, genuine solve incrementing, abandon rules, marks over the wire, assist rate limit
- [x] Two-browser session, 41 checks — Notes → mark → other player sees it, Undo, Check grading,
      keypad solve, modal on both clients with the same server time, start another, Reveal confirm,
      Back to Puzzle Select taking the whole room
- [x] 320px phone emulation — no horizontal scroll, 51×44 keypad keys, tap-a-square-tap-a-digit
- [x] Grayscale screenshot — every player still named
- [x] Fonts blocked — no layout shift, no invisible text
- [x] Dark theme at 320px and 1440px, toggle persists across a reload

> **Two bugs the browser pass caught**, both fixed:
> 1. Undoing back to a marks-only state left the digit in place, because a `marks` op preserved the
>    cell's value. Resolved by making a cell hold **a value or marks, never both** — which is how a
>    cell already rendered, and which makes a cell's whole state expressible in one op. That is what
>    lets undo restore any earlier state with a single write. See [design-spec.md §6](design-spec.md#6-the-shared-state-model-the-core-problem).
> 2. The wordmark overran a 320px viewport by 15px. `--text-wordmark` is now a `clamp()` rather than
>    a fixed `2.75rem`; it holds full size from ~500px up.

> **Prettier no longer checks Markdown** (`.prettierignore`). It reflows prose paragraphs and
> re-lays-out tables, which costs more in readability than it buys. [code-style.md §10](code-style.md#10-enforcement)
> is updated; the 4-space rule for docs is now review's job.

**Revision pass on the built UI** (50 browser checks: radius, ring colour, icons, switch state and
wiring, control order, both themes, 320px):
- [x] Chrome drops from `--radius-pill` to `--radius-control` (6px) — [brand.md §4](brand.md) records
      why the original 999px was wrong; the grid keeps its sharp corners and `--radius-round` is left
      for things that are genuinely round
- [x] One focus ring, in `--accent`, as a `focusRing` fragment composed into every shadow root that
      holds something focusable — the `base.css` rule reaches the light DOM only, so the keypad and
      the landing inputs had been falling back to the browser's own ring
- [x] `client/ui/icons.js` — erase, undo, pencil, sun, moon as inline SVG on `currentColor`
- [x] `<pt-switch>` — the Notes and Dark theme toggles become `role="switch"`, replacing a segmented
      pair and a button whose label changed under you
- [x] Notes moves above the keypad, so the control deciding what a key means sits over the keys

**Room and landing pass** (54 browser checks across two clients: tabs, palette, leaving, back/forward,
320px):
- [x] `player:color` — a player picks their own colour from their chip; the server refuses one
      another seat holds, so uniqueness does not depend on the picker's disabled swatches
- [x] `Leave room` on Puzzle Select
- [x] Leaving a room is what *navigating away from it* means — the button, the wordmark, and the
      back button share one path, and the roster no longer survives on the landing screen
- [x] Landing becomes `Create` / `Join` tabs over one form; a room URL with no seat opens Join with
      the code filled in
- [x] `server/rooms/lifecycle.test.js` — colour assignment, reuse after a leave, and the uniqueness
      rule under players swapping around

**Lobby pass, and the browser suite made permanent** (`tests/`, 82 checks in Chromium and Firefox —
`npm run test:ui`):
- [x] `room:kick` — the host removes a player behind a confirm dialog; the removed player is told
      before the seat is dropped and lands back on the landing screen with the reason
- [x] `you` on your own chip, `x/n` above the roster, and a Leave room button on the game screen as
      well as Puzzle Select, both carrying an icon
- [x] Landing tabs restyled as text over a rule rather than as buttons
- [x] Taken colours greyed *and* struck through — never one channel
- [x] **Chips are one box.** A button and a span brought different defaults into a shadow root that
      never got the page's `box-sizing` reset, so your own chip outgrew its track and looked
      different on your screen than on anybody else's
- [x] **Cells are one box.** Same root cause: `aspect-ratio` measured a content box that a heavy
      region border had shrunk, which Firefox showed as a 1px row misalignment. Region rules are now
      an overlay, which also stops them mitring with the hairlines and notching at every crossing
- [x] **Both grid axes declared**, in the mark grid and the presence layer. Implicit rows sized
      themselves to their contents, so marks shifted as their neighbours changed and presence dots
      landed correctly only on the top row
- [x] Presence dots enlarged to `--presence-dot`, and repaint the moment their player recolours

> **The browser suite is kept, not thrown away.** Every one of the visual bugs above was found by a
> person looking at the screen, and three of them were invisible to any assertion the unit tests
> could make. Firefox is in the matrix for the same reason: the alignment bug did not reproduce in
> Chromium at all.

> **`x/n` reads `x/8`, not `x/10`.** `MAX_PLAYERS_PER_ROOM` is 8 because the palette is 8 and a
> room's colours must stay unique — raising the cap means adding two colours that clear 4.5:1 on
> both themes ([brand.md §3](brand.md)) and re-running the contrast gate. Worth doing deliberately,
> not as a side effect of a counter.

---

## Phase 3 — Nonogram + KenKen

*Done when: both are playable and **adding them required no changes to `shared/` or `<pt-board>`**. If it did, the abstraction is wrong and gets fixed here.*

**KenKen**
- [x] KenKen generator: Latin square → cage partition → op assignment → uniqueness check
- [x] KenKen time budget / retry cap for larger sizes — plus cage *splitting*, which is what makes
      generation total rather than best-effort
- [x] `<pt-kenken-board>` — cage borders, cage labels. **40 lines, and no `<pt-board>` change.**
- [x] Sizes 4–7, difficulty as a generation parameter (recorded below)

**Nonogram**
- [x] Nonogram generator: bitmap → line-solver uniqueness rejection
- [x] Measured difficulty from the same line-solver, calibrated per size
- [x] `<pt-nonogram-board>` — clue gutters, tri-state cells, five-square counting bands
- [x] Nonogram drag-fill batched into single `fill` ops, axis-locked, one press of Undo per stroke
- [x] The run washes in the accent as the drag covers it, before the op commits — `isHighlighted`,
      the same `<pt-board>` hook crossword's entry highlighting will use
- [x] Filled squares take the whole cell, so a run reads as one bar rather than a line of dots
- [x] 20×20 nonogram kept, but the option leads with a warning triangle in Puzzle Select and a line
      saying why once picked; a type now defaults to its largest *uncautioned* size
- [x] The grid is opaque — the graph-paper texture was showing through the cells as a second,
      unaligned ruling inside the real one
- [x] Nonogram's counting bands are the hairline's colour at 3px rather than `--ink`, which read as
      thin filled squares competing with the picture. `--grid-frame-width` split out from
      `--grid-heavy-width` so a board can thicken its inner rules without moving its own clue gutters
- [x] Nonogram crosses sized to the square (0.92 of a cell) rather than to the type scale
- [x] Keypad slot becomes a `Fill · Cross · Erase` tri-toggle; Notes and the digits drop out, Undo stays

**Seams**
- [x] `client/boards/registry.js` — board element and input style per type, so `<pt-game>` branches on
      *how a puzzle takes input*, never on which puzzle it is
- [x] `server/puzzles/value-grid.js` — `isComplete` / `checkCells` / `digitAlphabet` shared by sudoku
      and kenken instead of copied into the new type
- [x] `DIFFICULTY_MIN_SIDE` becomes per type — the floor was sudoku's, not the platform's
- [x] **Confirmed: `shared/` needed no logic changes** (see below)

**Tests**
- [x] `server/puzzles/kenken/kenken.test.js` — clue truth, cage coverage and connectivity, Latin
      square, uniqueness, 7×7 inside budget
- [x] `server/puzzles/nonogram/nonogram.test.js` — line-solver deductions, ambiguity refused,
      measured labels, completion on fills alone
- [x] `tests/puzzle-types.spec.js` — 14 browser checks per engine

**Verify**
- [x] Full gate green: 181 unit tests, lint, typecheck, Prettier, build, **114 browser checks** in
      Chromium and Firefox
- [x] 20×20 nonogram at 320px — no horizontal scroll, square frame, 44px brush targets. It fits, but
      the squares end up around ten pixels with the gutters taking a third of the width, which is
      what the Puzzle Select caution now says out loud rather than leaving the host to discover
- [x] Visual check of the brand against the mock's actual KenKen layout — cage rules read as the
      mock's signature heavy borders; `+ − × ÷` render in Karla

> **The abstraction held where it mattered and was extended where it did not.** No logic changed in
> `protocol.js`, `schema.js`, `board-reducer.js`, or `puzzle-doc.js`: the batched `fill` op and the
> one-character cell value were specified in Phase 1 and were waiting. `constants.js` gained list
> entries, which is the intended cost of a type.
>
> `<pt-board>` gained `valueGlyphs` and `renderTopGutter` / `renderSideGutter`. That is a gap closing
> rather than an abstraction failing — [design-spec.md §7](design-spec.md#7-the-puzzle-abstraction)
> claimed since Phase 0 that subclasses supply cell rendering and clue gutters, and neither hook
> existed because sudoku never asked. Both are general and cost the other types nothing.
> **KenKen needed no `<pt-board>` change at all.**

> **KenKen's difficulty is a generation parameter; nonogram's is measured.** Deliberate, not an
> oversight. A nonogram's line-solver already has to run to prove the puzzle fair, and the sweeps it
> takes *are* the difficulty — free and honest. Rating a KenKen would need a technique-ranked cage
> solver, which is the same expensive search that already dominates its generation. So KenKen's label
> is what was asked for and sudoku's and nonogram's are what was measured, and that difference is
> written down here rather than discovered later.

> **Three bugs the browser pass caught**, all in shared machinery rather than in the new types:
> 1. `--cell-size` was published on the grid, which the clue gutters are not inside — so at 20×20 on
>    a phone twenty clue rows sized themselves for a 40px cell and stretched the frame half again as
>    tall as the squares in it. It is published on the host now.
> 2. **A circular layout dependency**: clue size came from the cell size, which came from the grid
>    width, which is what is left after the gutter, which is as wide as its clues. The board reflowed
>    two or three times settling it, and a tap during the settle painted the wrong square. The board
>    is a size container now and the clues size off `cqw`, which nothing downstream can move.
> 3. Clicking a cell called `focus()`, which **scrolls**, so the grid moved out from under the finger
>    still on it. `preventScroll` — a fix for every board type, not just nonogram.

> **A stroke that ends outside the window still commits.** The release is watched on the window
> rather than the grid, because letting go past the bottom of a tall grid is easy and used to discard
> everything the player had just painted.

---

## Phase 4 — Crossword + bank

*Done when: a 15×15 puzzle is co-op solvable with synchronized clue-list state.*

- [ ] **BLOCKER: resolve crossword content licensing** — see [ADR-0004](adr/0004-hybrid-puzzle-supply.md)
- [ ] Bank format + `data/crosswords/index.json` manifest
- [ ] `BankProvider` + boot-time validation of every bank file
- [ ] `scripts/import-crossword.js` — `.puz` / `.ipuz` converter
- [ ] Hand-authored seed minis
- [ ] `<pt-crossword-board>` — black squares, numbering, entry highlighting
- [ ] Clue list UI with synchronized current-entry state
- [ ] Direction toggle, auto-advance, Tab/Enter navigation

---

## Phase 5 — Hardening

*Done when: CI is green and the production build survives a load test.*

- [ ] Generator invariant tests (200 puzzles per type, uniqueness + rating stability)
- [ ] Board reducer tests — LWW ordering, sequential-ops-equals-snapshot
- [ ] Protocol schema tests — malformed payloads rejected, no handler crashes
- [ ] Room lifecycle tests — reconnect, host election, streak rules, GC
- [ ] Bank loader test — every file validates
- [ ] GitHub Actions CI: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:ui && npm run build`
      (`npx playwright install --with-deps chromium firefox` first)
- [ ] Dockerfile + `.env.example`
- [ ] Load test — N simulated players in one room
- [ ] README covering local dev and the multi-instance constraint

---

## Open questions

Carried from [design-spec.md §14](design-spec.md#14-risks-and-open-questions). Resolve and record the answer here.

| # | Question | Needed by | Status |
|---|---|---|---|
| 1 | Crossword content licensing — what can legally ship? | Phase 4 | **Open** |
| 2 | Does Fraunces `WONK` survive contact with real screens? | Phase 1 | **Resolved — keep.** Reads as hand-cut rather than generic-serif at 2.75rem; it is the most distinctive thing on the page. |
| 3 | Does the paper texture read as subtle or as noise? | Phase 1 | **Resolved — keep at 3%.** Invisible until looked for, on both the landing and game screens. |
| 4 | Can 8 player colors all clear AA on cream, or drop to 6? | Phase 1 | **Resolved — 8 survive, but per theme.** One shared set cannot clear 4.5:1 on both backgrounds; `--player-N` is now defined in each theme block. |
| 5 | Does per-cell LWW feel bad in practice? | Phase 2 playtest | Open — the machinery is now all there to judge it, but two scripted browsers are not a playtest. Soft-lock fallback stays in [ADR-0001](adr/0001-shared-state-lww-per-cell.md). |
| 6 | Is Lit fast enough for a 25×25 grid? | Phase 1 | **Resolved — yes, comfortably.** 625 cells: 19ms first render, 2.9ms median / 5.3ms p95 single-cell update, 1.7ms presence update. |
| 7 | KenKen uniqueness cost above 7×7 | Phase 3 | **Resolved — 7×7 stands.** Measured across 15 puzzles per size and difficulty: ~1ms at 5×5 hard, ~11ms at 6×6 hard, **~170ms median / 870ms worst at 7×7 hard**; easy and medium are single-digit ms everywhere. Well inside a background pool refill, so no player waits on it. Above 7×7 was not measured and is not offered. |
| 8 | Sudoku difficulty targeting misses the requested band ~1% of the time | Phase 2 | **Resolved for the sizes that matter.** 4×4 and 6×6 always measure `easy` — there is no room for a technique beyond singles — so Puzzle Select disables the difficulty picker below 9×9 and says why (`DIFFICULTY_MIN_SIDE`). At 9×9 the ~1% miss stands, and the label remains the measured rating. |
| 9 | Undo is per-player and forward-only — does it surprise people? | Phase 3 playtest | Open, and now with more surface. A cell somebody else has touched since is left alone with a notice; whether that reads as "safe" or "broken" still needs real players. Phase 3 added the **partial** case: one drag is one undo, so if a single square of a twenty-square stroke has moved on, the other nineteen are restored and the notice says the rest were left. All-or-nothing was the alternative and seemed clearly worse; unverified with players. |
