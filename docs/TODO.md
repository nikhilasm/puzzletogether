# PuzzleTogether — Progress

> The first place to look to answer "where are we?" Updated **as part of** the work it tracks, never reconstructed afterward.
>
> Phases and their done-when criteria come from [design-spec.md §13](design-spec.md#13-phases).

**Current phase**: 4 — crossword + bank
**Branch**: `feature-puzzletogether`
**Last updated**: 2026-08-05

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
- [x] Vite + Lit + Express + Socket.IO scaffold; dev proxy 5173 → 3001 (proxy target follows `PORT`;
      the default moved off 3000 in Phase 4 and both sides moved together)
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
- [x] KenKen cage clues take a row of the mark grid to themselves (`reservesLabelRow`), so a full set
      of notes no longer paints over the clue it is working out; the clue is sized by that row rather
      than by `--text-sm`, the one thing in a cell that had not scaled with the grid
- [x] **The cage clue is spoken.** `DocCell.label` was drawn and never put in the cell's `aria-label`,
      so a kenken's entire set of constraints was missing for anyone not looking at the screen —
      against what [design-spec.md §11](design-spec.md#11-client-architecture) has claimed since
      Phase 0. Said as arithmetic (`cage 12 plus`) via a new `spokenLabel` hook, because a screen
      reader at normal verbosity skips punctuation and announces `12+` as "12". A blocked square now
      says "blocked" rather than "empty" — unreachable until crossword, and cheaper to write here
      than to remember there

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
- [x] Full gate green: 181 unit tests, lint, typecheck, Prettier, build, **128 browser checks** in
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

- [~] **Crossword content licensing** — see [ADR-0004](adr/0004-hybrid-puzzle-supply.md). **No longer a
      blocker on building**, still open on shipping. Decided 2026-08-03: the importer is developed
      against four freely-distributed `.puz` files in `data/`, which proves the pipeline without
      settling what may be served. They are `.gitignore`d — freely downloadable is not freely
      redistributable, and committing one is the act of redistributing it. `data/crosswords/`, the
      tracked bank the app serves, is seeded only with puzzles whose licence is known

**Design settled 2026-08-03**, before any code — [design-spec.md §4 *Crossword*](design-spec.md#crossword), [§7](design-spec.md#7-the-puzzle-abstraction), [§8](design-spec.md#8-generation), [ADR-0007](adr/0007-rebus-widens-the-cell-value.md)

- [x] **Clue layout: a current-clue bar under the grid, full lists behind a button.** Two scrolling
      lists plus a 15×15 do not fit a phone, and on the desktop column they would take the grid's
      width to show something read once per entry. The bar is always on screen and is itself the
      direction toggle; the dialog is where you go to look for a way in. The cost — scanning becomes
      a tap — is accepted, and a desktop side panel is the additive fallback if play disagrees
- [x] **Letters come from our own keyboard, not the phone's.** `<pt-letter-pad>` takes the slot the
      digits and brushes already use, so crossword joins the one-input-path rule instead of escaping
      it. A native keyboard means fighting autocapitalize and predictive text, an unknowable amount
      of viewport on a 15×15, and the offscreen-`<input>` hack per platform. Revises §4, which had
      said crossword would fall back to the native keyboard
- [x] **Rebus is supported, not deferred**, so the cell-value bound moves from 1 character to 8 —
      the first change to `shared/` a puzzle type has forced since Phase 1, recorded with its
      consequences in [ADR-0007](adr/0007-rebus-widens-the-cell-value.md). Typing replaces a square;
      **Rebus** on (or <kbd>Shift</kbd> held) appends. No new op type: a rebus keystroke is a `set`
      carrying the whole accumulated string, so LWW, undo pre-images, and snapshots are untouched
- [x] **Clue list follows your own cursor only.** Adding direction to `game:focus` would let it show
      precisely which entry each player is on; deliberately not built, because it is a `shared/`
      change bought for a nicety. Others stay visible as presence dots. Revisit after real play
- [x] **Decided: crossword entry lookup is client-side**, in `client/boards/crossword-entries.js`,
      not in `shared/puzzle-doc.js` where [design-spec.md §5](design-spec.md#5-repo-layout) has
      listed it since Phase 0. `shared/` is what *both sides* need, and the server does not need it:
      a crossword's `validateOp` / `isComplete` / `checkCells` are the value-grid code sudoku and
      kenken already share, and none of them asks what an entry is. Entries serve highlighting,
      auto-advance, and clue-list sync — all rendering. Keeping them out of `shared/` is also what
      keeps Phase 3's "a new type touches nothing shared" result from decaying by technicality

**Shared** — the one place this phase does touch it

- [x] `MAX_CELL_VALUE_LENGTH = 8` in `constants.js`; `schema.js`'s `cellValue()` accepts 1–8
- [x] **Fix the substring bug the widening makes reachable**: sudoku and kenken gate values with
      `doc.meta.alphabet.includes(op.value)`, which matches *substrings*, so `'12'` passes. Harmless
      only because the length-1 schema rejects it first. Becomes a character-set test — do this in
      the same commit as the bound, never after
- [x] `PUZZLE_TYPES` / `PUZZLE_TYPE_NAMES` / `DIFFICULTY_MIN_SIDE` gain `crossword`

**Bank and importer**

- [x] Bank file format: the finished doc plus its solution — the loader validates, it does not compile
- [x] `numberGrid()` — entry numbering from the grid, run by the importer to *produce* the file and
      by the loader to *check* it. One function, both directions; a stored entry list nothing
      verifies is only a second place to be wrong
- [x] `data/crosswords/index.json` manifest: id, size, difficulty, tags, source, **license**
- [x] `BankProvider` + boot-time validation of every bank file, including the numbering re-derivation
- [x] `scripts/import-crossword.js` — `.puz` reader: header, solution grid, clues, extensions
- [x] Carry `GRBS`/`RTBL` rebus and `GEXT` circles; ignore `LTIM`/`RUSR` (a timer and a stranger's
      partial solve — somebody's session, not the puzzle)
- [x] Refuse, by name and reason: scrambled solutions, grids past 25×25, rebus past 8 characters,
      and any file whose derived numbering disagrees with its own clue count
- [x] `--license` is a **required** argument — no guessing from the copyright string. This is
      [ADR-0004](adr/0004-hybrid-puzzle-supply.md)'s build/ship split made mechanical
- [x] `.ipuz` reader (the same doc out, a different file in)
- [x] Hand-authored seed minis — the puzzles whose licence is unambiguous

**Server**

- [x] `server/puzzles/crossword/index.js` — **three** methods, not four: a banked type generates
      nothing, so it has no `create` (see the note below). `isComplete` / `checkCells` are the shared
      value-grid pair; `validateOp` bounds values to 1–8 characters of the alphabet
- [-] ~~`checkCellsByValue` skips block squares~~ — **not needed, and not written.** `checkPuzzle`
      already passes `editableIndices(doc)`, which excludes blocks, so the shared helper never sees
      one. Planned work that turned out not to exist
- [x] `provider.catalog()` — what is genuinely available per type, computed at boot, sent on the
      `room:create` / `room:join` ack. A type with nothing behind it is **not offered at all**,
      which is the normal state of a build with no licensed bank rather than an error state
- [x] The catalog carries `{ rows, cols }` pairs for crossword — real crosswords are 15×15 and 5×5
      and also 20×21, and `SIZES_BY_TYPE` holds square sides
- [x] A room does not serve the same banked puzzle twice running

**Client — board**

- [x] `<pt-crossword-board>` — black squares, entry numbers, entry highlighting via `isHighlighted`
- [x] `client/boards/crossword-entries.js` — cell → entry index, built once per doc
- [x] `<pt-board>`: `nextSelection(from, dRow, dCol)`, `advanceAfterInput(idx)`, `isCircled(idx)`;
      `spokenLabel` gains the cell index
- [x] `<pt-board>`: **a blocked square is never selected**, by click or by arrow. Not a hook and not
      crossword's — the base element answering a question the doc schema has allowed since Phase 0
- [x] `<pt-cell>`: value sizes to fit 2–5 characters and then holds, with the whole string in the
      `aria-label`; `?circled` draws a `--graphite` ring
- [x] Navigation, literally per §4: type-advance stops at the end of an entry, click-selected flips,
      Tab/Shift+Tab move entry, arrows across the direction move *and* flip

**Client — clues and input**

- [x] `<pt-clue-bar>` — number, direction, clue text, and the direction toggle, under the grid
- [x] `<pt-clue-list>` — Across and Down in a dialog; current entry marked, picking one jumps and closes
- [x] `<pt-letter-pad>` — QWERTY in the keypad slot; registry `input: 'letters'`
- [x] **Rebus** switch in the mode-bar slot, beside where Notes and the brush bar live; <kbd>Shift</kbd>
      is the physical-keyboard equivalent
- [x] <kbd>Backspace</kbd> in Rebus mode removes the last character; Erase still clears the square
- [x] Puzzle Select reads the catalog rather than `SIZES_BY_TYPE` for crossword. **The 15×15
      small-screen caution was planned and then not written** — measuring it said it was not needed
      (below), so `SIZE_CAUTION` has no crossword entry

**Tests**

- [x] `server/puzzles/crossword/crossword.test.js` — numbering against known grids, block handling in
      `checkCells`, value bounds including rebus
- [x] `scripts/import-crossword.test.js` — every refusal fires, on `.puz` files **built byte by byte
      in the test** rather than read off disk. The four real samples are `.gitignore`d, so a test
      depending on them would pass here and fail on every other machine
- [x] `shared/schema.test.js` — the new bound, and that a 2-character value is still refused by
      sudoku and kenken
- [x] `server/puzzles/bank.test.js` — the tracked seed minis all validate and re-derive their own
      numbering, plus a fixture broken one specific way per refusal
- [x] `tests/crossword.spec.js` — direction toggle, auto-advance, entry highlight, clue dialog,
      letter pad, rebus entry, two clients on one grid

**Verify**

- [x] 320px: a 15×15 grid, clue bar, and letter pad with **no horizontal overflow** — 19px squares,
      25×44 letter keys
- [x] Two players type into one crossword and see each other's letters
- [x] A rebus square holds a word, shrinks to fit, and peels back one letter at a time
- [x] Full gate: **231 unit tests**, lint, typecheck, Prettier, build, **162 browser checks** in
      Chromium and Firefox
- [x] **A 15×15 solved end to end by two people — a real playtest, 2026-08-05.** The phase's
      done-when criterion, and the first time any of this has been in front of somebody who was not
      building it. It is *not* in the automated suite and cannot be: the only 15×15 available sits in
      the gitignored local bank, so the check would fail on a fresh clone. Everything it rests on is
      covered against the 5×5 minis; the full-length solve is verified by play and says so. A
      tracked, licensed 15×15 is what would let the suite hold it
- [x] No socket frame carries solution letters before completion — **automated for the first time**
      rather than done by eye in devtools, and verified to fail against a deliberately leaked
      snapshot. A frame is reduced to its capitals before searching, because a leak would travel as
      `["C","L","O","S","E"]` one cell at a time; the first version searched for contiguous words
      and passed happily against a real leak

> **The one `shared/` change was the one that was planned, and it opened a hole that had to be
> closed in the same commit.** `schema.js`'s cell-value bound moved from 1 character to 8 so rebus
> squares could exist ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). Nothing else in
> `shared/` changed shape: no op, no event, no reducer. But the widening made a latent bug reachable
> — sudoku and kenken gated values with `doc.meta.alphabet.includes(value)`, which on a string is a
> *substring* test, so `'12'` would have passed the moment anything two characters long could get
> that far. Both now test length as well. Nonogram was never exposed, because it matched against an
> array of allowed values rather than searching a string.

> **The four-method module interface is really two interfaces.** `create` produces a puzzle; the
> other three rule on one. Three types needed both because they generate their own puzzles, so the
> distinction never had to be drawn — and crossword generates nothing, so its module has no `create`
> at all. `provider.js` knows which producer a type has, which is exactly the seam it was built to
> be. The rules turned out to be almost entirely borrowed: `isComplete` and `checkCells` are the
> value-grid pair, unchanged, because a letter is not different from a digit in any way they can
> see. **`value-grid.js` needed no change either** — `editableIndices` already excluded block
> squares, so the planned "skip blocks in `checkCells`" was work that did not exist.

> **Three bugs the build caught, two of them by checks written for exactly that.**
> 1. The `.puz` reader stopped one string short of the notes, so the extension scan began inside
>    somebody's prose and found nothing — reporting every sample as having no rebus and no circles
>    rather than failing. Caught by noticing the counts were zero when three files were known to
>    carry them.
> 2. Fixing that made the reader count the notes as a clue, and the importer refused all four files
>    with "the grid implies 78 entries but the file carries 79". That is `numberGrid` doing the job
>    it exists for, on its author, within a minute of being written.
> 3. The solution-secrecy test passed against a deliberately leaked snapshot, because it searched
>    for contiguous words and a leak is one cell at a time. A test that cannot fail is worse than no
>    test; it now strips frames to their capitals, and was re-verified against the same leak.

> **ESLint and Vitest both widened to `scripts/`, 2026-08-05.** The scope rule since Phase 1 has
> been "`shared/` because it is the contract, `tests/` because nothing else checks them"; `scripts/`
> earns it on a third reason again — it is the only code that *writes content into the repo*. The
> importer produces the bank files the server serves, is run by hand and rarely, and is therefore
> exactly where a typo waits months to be found. It is pure Node, which is the one way its lint
> config differs from the others. [code-style.md §10](code-style.md#10-enforcement) is updated.

> **A backtick inside a CSS comment ends the `css` template literal.** Third phase running. Cost one
> build failure in `<pt-cell>`; there is now a scanner in the scratchpad, which is not the same as
> having one in the repo — worth making a lint rule in Phase 5.

> **The 15×15 small-screen caution was designed and then not written.** Measuring said it was not
> needed: 19px squares at 320px with no horizontal overflow, which is what every crossword app on a
> phone ships, and nothing like the 20×20 nonogram whose gutters eat a third of the width. Writing
> the caution anyway would have warned about a size that is fine.

### Revision pass on the built crossword

*After the first real playtest — two people, one 15×15, 2026-08-05. Everything here is a change to
something that already worked; the phase's original items above are left as they were rather than
rewritten to look prescient.*

**Settled by the playtest** (open questions 5, 9, 10, 11 in the table below)

- [x] LWW, per-player undo, and the clue list behind a button all hold. **Three fallbacks that were
      designed and reserved are now not needed and should not be built**: the soft-lock on focused
      cells ([ADR-0001](adr/0001-shared-state-lww-per-cell.md)), the all-or-nothing undo, and the
      desktop clue side panel

**The letter pad is removed** → [ADR-0008](adr/0008-native-keyboard-for-crossword.md)

- [x] Delete `<pt-letter-pad>`; crossword's registry entry returns to `input: 'native'`
- [x] A hidden, focused `<input>` summons the OS keyboard and becomes the **single source of
      crossword key events on every platform**, desktop included. The grid stops holding focus;
      `:focus-within` keeps the ring where it belongs
- [x] Read `beforeinput` / `input` and their `inputType`, never `keydown` — an Android IME reports
      `keydown` as keycode 229 with `key: 'Unidentified'`, so a keydown reader works on a desktop,
      appears to work in an emulator, and fails on a phone.
      **One exception found while building it**: Backspace is taken from `keydown` where a named key
      arrives, because the input is kept empty and an empty input raises no deletion event to read.
      So "single source" is true of letters and not quite true of deletion
- [x] `font-size: 16px` on the hidden input, or iOS zooms the page on focus
- [x] The clue bar becomes a **pinned bar** above the keyboard, positioned from `visualViewport`:
      clue · **Rebus** · **Undo** · **All clues**, one row, the last three as icons
- [x] **Erase is dropped** — the keyboard's own ⌫ is the counterpart to pressing a letter, which is
      the same reasoning §4 used to drop Erase from nonogram's brush bar. Consequence to accept:
      clearing a four-letter rebus is four presses, since Backspace peels a letter at a time
- [x] **Shift stops working as a rebus signal on mobile** (a phone's shift key just gives an
      uppercase letter), so the Rebus toggle is the only mobile path. Shift survives on desktop,
      read off the `keydown` preceding each `beforeinput` rather than tracked as held state
- [x] Arrow keys, Tab, Space, and Backspace move to the input alongside the letters — the whole of
      `<pt-crossword-board>`'s navigation, not only its text entry.
      **Cost not foreseen in the ADR**: `<pt-board>` now listens for keys on the host rather than on
      `.grid`, and gains `renderOverlay` and `focusTarget` hooks. That is a base-element change,
      which Phase 3's rule says a new type should not need — recorded rather than hidden
- [x] `tests/crossword.spec.js` — the letter-pad checks become native-input checks; the pad's own
      browser checks go away with it

**Puzzle Select shows the bank rather than describing it** → [ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)

- [x] `bankCatalog()` gains a `puzzles` array — `id`, `title`, `author`, `source`, `size`,
      `difficulty` — and `game:start` gains an optional `puzzleId`, validated as shape only
- [x] `<pt-puzzle-picker>` renders **two shapes, chosen by the provider rather than the puzzle
      type**: a scrolling list of cards where the catalog carries puzzles, the size and difficulty
      rows where it does not
- [x] A named puzzle beats the room's `served` set — pressing a title means that title, even if the
      room has played it. An id the bank no longer holds falls back to the description rather than
      failing the start
- [x] The picker announces the default it resolves to, so the list cannot show one card as chosen
      while Start still carries "any 5×5"
- [-] Filters over the list — deferred here as clutter at four puzzles, built two days later once
      the bank had two sizes in it. → **Filtering the bank**, below

**The rest of the visual list**

- [x] The clue button is a **next clue** button, walking the direction being worked (7D → 8D), not
      the direction toggle. Turning around keeps the re-tap gesture, Space, and the perpendicular
      arrow — and so has no button on a touch screen, which is now a recorded risk
- [x] `7D`, not `7 Down`. The full words stay in the accessible name
- [x] The cursor and its entry are pulled apart, 34%/30% → **62%/13%**. Four percentage points of
      the same accent was a difference nobody could see
- [x] Typing **steps over squares already filled**, so a half-filled entry can be typed into without
      overwriting the crossings — most likely somebody else's, in a room solving together
- [x] Backspace **clears and steps back**, and never leaves the entry. A rebus mid-assembly peels one
      character and keeps the cursor
- [x] The cell label is sized off `--cell-size` rather than `--text-sm`, floored at 7px and capped at
      the old size. It was the last thing in a cell not derived from the cell

### The input panel

*After the second playtest — the same crossword, on an iPhone, 2026-08-06. It reversed the largest
decision of the pass above, one day old.* → [ADR-0010](adr/0010-one-pinned-input-panel.md)

> **What the playtest actually said.** The keyboard's letters were fine. Everything around them was
> not: half of a solver's ordinary actions dismiss it — tapping a square, opening the clue list,
> toggling Rebus, scrolling the grid — and the bar riding above it on `visualViewport` was "flaky at
> best". That is not a bug to be fixed; it is what a fixed control strip against a viewport somebody
> else animates costs, and ADR-0008 had named every piece of it as a cost accepted.

- [x] Crossword returns to a pad of ours; registry `input: 'native'` → `'letters'`. The keys are
      **QWERTY**, which is the part of the platform keyboard the earlier playtest was actually asking
      for — muscle memory, not the platform's ownership of the screen
- [x] `<pt-keypad>` becomes the **pinned input panel for every type**: `position: fixed` at the foot
      of the viewport, with `clue` and `actions` slots above the keys and `env(safe-area-inset-bottom)`
      for the iPhone home indicator
- [x] Everything that acts on a square moves into it — Notes, brushes, **Rebus**, Erase, Undo, and
      crossword's **All clues**. Everything that acts on the puzzle stays down the page. That was
      already the rule; it is now a difference between two places rather than a hairline
- [x] `<pt-clue-bar>` loses its fixed positioning, its `visualViewport` listener, and its three tool
      buttons. It is the panel's top strip and shows the clue, which is still the next-clue button
- [x] **The page reserves the panel's height in `<pt-app>`, after the footer** — not in `<pt-game>`.
      Found by a browser test, not by reading: a spacer inside the game screen left the footer's
      theme switch under the keys, unclickable at every scroll position
- [x] Every control in the panel suppresses focus on `pointerdown`, or the grid blurs and physical
      typing stops. The keypad and brush bar already did; **Notes and Rebus did not** and now do
- [x] **All four of the base-element changes above are given back.** `renderOverlay`, `focusTarget`,
      `describeCell`, and the host key listener are deleted; keys are read on `.grid` again, as
      through Phase 3. The pressure on `<pt-board>` came from borrowing the platform's input, not
      from crossword being a fourth type
- [x] Gone with it: the hidden `<input>`, the `beforeinput`/`inputType` reader, the Android IME
      workaround, the iOS 16px rule, the shadow-root `focusin` redirect, and `#shiftDown`
- [x] `tests/game.spec.js` — the geometry checks are rewritten for a fixed panel: it stays at the
      viewport foot across a scroll, and nothing (Leave room, the theme switch) is stranded under it.
      `tests/crossword.spec.js` — the pad types without stealing focus, ⌫ walks back through the
      entry, and the rows are QWERTY

> **The backtick-in-a-CSS-comment trap, sixth occurrence — and the first the build did not catch.**
> `` `<pt-game>` `` in a comment inside `<pt-app>`'s `css` block truncated the stylesheet, and the
> remainder happened to parse as valid JavaScript. `npm run build` succeeded; every browser test then
> failed at once on `pt is not defined`, with nothing pointing at the CSS. **The build is not the
> check.** `node -e "import('./client/…/thing.js')"` on each changed component is — a module that
> loads is a template that closed. Still worth a lint rule in Phase 5, now more than before.

### Filtering the bank

*A list long enough to want narrowing. This is the alternative
[ADR-0009](adr/0009-a-bank-is-browsed-not-described.md) rejected two days earlier as "pure clutter at
four" — adopted rather than reversed, because the clutter case is now the case that draws nothing.*

- [x] **Size and difficulty filter rows above the card list**, each drawn only where the bank has
      more than one value behind it. On the tracked bank — four minis, all 5×5, all easy — neither
      appears, which is the whole of the answer to the objection that deferred them
- [x] **An option that would leave nothing on show is disabled, not hidden.** That is not only
      manners: an option is pressable only if something is behind it *given the other filter*, so
      every reachable pair holds a card and the list can never come up empty with Start still aimed
      at whatever was selected before
- [x] Filtering the chosen card away moves the selection to the first one still visible, and the
      picker announces it — the same property that stopped the list showing one card as chosen while
      Start carried "any 5×5"
- [x] `Choose a puzzle · 2 of 12` while a filter is on, and plain `Choose a puzzle` when it is not
- [x] **The card states its difficulty.** ADR-0009 said it did and it did not; a filter narrowing on
      a fact the cards do not show would be a guessing game
- [x] The list takes the whole 40rem column in Puzzle Select *and* in the congrats modal, while the
      picker caps its own option rows at 28rem and centres them. 28, not 26: it is where the four
      puzzle types stop wrapping
- [x] `tests/puzzle-select.spec.js` — the list against the real app and the tracked bank, the filters
      against a picker mounted alone behind an invented catalog. The filters cannot be driven from
      the tracked bank, since that bank is exactly the case where they are not drawn
- [x] **`PT_BANK_DIRS` pins the bank the browser suite reads** to the tracked directory. Found while
      writing the above: `data/crosswords-local/` is a scratch space, so any test that asserts what
      the bank *holds* was passing or failing on which `.puz` files the developer last imported

### Presence and player colour

*Where everybody is, and whose colour is whose. The dots had two complaints against them and they
turned out to be one complaint: presence was drawn in the cell's content area at a size that grew
with the room.*

- [x] **Presence is a segmented stripe on the cell's bottom edge**, one equal share per player, in
      place of up to three corner dots and a `+n`. An edge cannot cover a pencil mark, and a fixed
      footprint that subdivides has no fourth-player problem — eight players are eight thin bands.
      The cap and its overflow count are gone
- [x] Its thickness comes from `--cell-size` like everything else in the grid, clamped to 3–6px. The
      dots were a flat 9px, which was the one piece of grid furniture that did not scale: three of
      them overflowed a 15×15's squares on a phone before the `+n` could even appear
- [x] **Two more player colours — sky and grey — for ten against eight seats.** The palette used to be
      exactly the size of the room, so a full room had nothing to change *to*. `MAX_PLAYERS_PER_ROOM`
      is now a layout question and nothing else. Both clear 4.5:1 on both themes, per the contrast
      test that already gates the palette
- [x] **Tried and reverted: a colour bar down the leading edge of each player chip.** Ten of them
      stacked in a two-column grid read as a rack of tabs, and the second channel bought nothing the
      name in that colour was not already carrying. The chip's colour is its name, as before
- [x] **Your own cursor is drawn in your own colour.** The board publishes the local player's
      `--player-N` as `--focus-color`; `<pt-cell>` mixes both washes from it, so every type inherits
      it, and crossword and nonogram keep their own strengths by overriding the mix and not the hue
- [x] **Sudoku and kenken highlight the cursor's row and column**, which is what the lighter wash was
      already for elsewhere. `isHighlighted` in `<pt-board>` now returns that by default instead of
      `false`; crossword (its entry) and nonogram (the run a drag has covered) already overrode it
- [x] `[highlighted]` is `:not([selected])` in the base element, so context can no longer paint over
      the cursor. Nonogram overrides that deliberately: its highlight is a gesture in progress rather
      than context, and has to be legible on the square the cursor is sitting on
- [x] **The room code, seat count, and roster are one panel.** Code top left at its old size, count
      top right, unlabelled and centred against it — the word "Players" over a `2/8` at the head of
      the roster it counts was saying it twice, and a shared baseline hung the smaller of the two off
      the bottom of the line. The count moves to `<pt-app>`: it is a fact about the room, not about
      the chips
- [x] **The panel is a rule, not a filled box**, and sits `--space-4` above the grid rather than
      `--space-8`. On `--paper-raised` it read as a card to be dealt with before getting to the
      puzzle, which is exactly backwards — it is a caption on the room
- [x] Known and accepted: on a nonogram's filled square the stripe sits on solid `--ink`, where a
      player colour reads at about 3.5:1. Visible, quieter than it is on paper. A `--paper` backing
      behind the stripe would fix it and would leave a pale notch across any washed cell

---

## Phase 5 — Hardening

*Done when: CI is green and the production build survives a load test.*

- [ ] Generator invariant tests (200 puzzles per type, uniqueness + rating stability)
- [ ] Board reducer tests — LWW ordering, sequential-ops-equals-snapshot
- [ ] Protocol schema tests — malformed payloads rejected, no handler crashes
- [ ] Room lifecycle tests — reconnect, host election, streak rules, GC
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
| 1 | Crossword content licensing — what can legally ship? | Phase 4 | **Split, 2026-08-03.** Building is unblocked: the importer is developed against freely-distributed `.puz` files, kept out of the repo. What may legally *ship* is still open, and hand-authored minis remain the safe seed. |
| 2 | Does Fraunces `WONK` survive contact with real screens? | Phase 1 | **Resolved — keep.** Reads as hand-cut rather than generic-serif at 2.75rem; it is the most distinctive thing on the page. |
| 3 | Does the paper texture read as subtle or as noise? | Phase 1 | **Resolved — keep at 3%.** Invisible until looked for, on both the landing and game screens. |
| 4 | Can 8 player colors all clear AA on cream, or drop to 6? | Phase 1 | **Resolved — 8 survive, but per theme.** One shared set cannot clear 4.5:1 on both backgrounds; `--player-N` is now defined in each theme block. |
| 5 | Does per-cell LWW feel bad in practice? | Phase 2 playtest | **Resolved — no, 2026-08-05 playtest.** Two people on one 15×15: last-writer-wins reads as logical rather than as a loss. The soft-lock fallback in [ADR-0001](adr/0001-shared-state-lww-per-cell.md) is not needed and should not be built. |
| 6 | Is Lit fast enough for a 25×25 grid? | Phase 1 | **Resolved — yes, comfortably.** 625 cells: 19ms first render, 2.9ms median / 5.3ms p95 single-cell update, 1.7ms presence update. |
| 7 | KenKen uniqueness cost above 7×7 | Phase 3 | **Resolved — 7×7 stands.** Measured across 15 puzzles per size and difficulty: ~1ms at 5×5 hard, ~11ms at 6×6 hard, **~170ms median / 870ms worst at 7×7 hard**; easy and medium are single-digit ms everywhere. Well inside a background pool refill, so no player waits on it. Above 7×7 was not measured and is not offered. |
| 8 | Sudoku difficulty targeting misses the requested band ~1% of the time | Phase 2 | **Resolved for the sizes that matter.** 4×4 and 6×6 always measure `easy` — there is no room for a technique beyond singles — so Puzzle Select disables the difficulty picker below 9×9 and says why (`DIFFICULTY_MIN_SIDE`). At 9×9 the ~1% miss stands, and the label remains the measured rating. |
| 9 | Undo is per-player and forward-only — does it surprise people? | Phase 3 playtest | **Resolved — no, 2026-08-05 playtest.** It behaves as people expect. The partial case (a drag whose squares have since moved on restores the rest and says so) did not come up in play and stays unverified in the specific, but the model itself is not the surprise it was suspected of being. |
| 10 | Do clue lists work behind a button, or do solvers want them beside the grid? | Phase 4 playtest | **Resolved — behind a button is right, 2026-08-05 playtest.** It works as a launching point rather than only as a reference, which is the use the design was least sure of. The desktop side panel fallback is not needed. |
| 11 | Is our own letter pad better than the phone's keyboard? | Phase 4, early | **Resolved, twice, and the second answer stands.** 2026-08-05: no — people want the layout their thumbs know, so the pad went. 2026-08-06, on an iPhone: the keyboard's letters were fine and the screen around them was unworkable, so **the pad came back in QWERTY and got pinned**. The two findings agree once separated — what solvers wanted was the *arrangement*, not the platform owning the bottom of the screen. → [ADR-0010](adr/0010-one-pinned-input-panel.md) |
| 12 | Is 8 the right rebus ceiling, and will review hold the per-type value bound? | Phase 4 → 5 | Open. 8 comfortably holds every rebus in ordinary use, but it is a judgement. The larger question is [ADR-0007](adr/0007-rebus-widens-the-cell-value.md)'s stated cost: `schema.js` no longer stops a type from accepting a long value, so a fifth type that forgets gets a bug rather than an error. |
| 13 | Turning the cursor around has no button on a touch screen — is re-tapping enough? | next playtest | Open, and unchanged by the 4b rework. The clue strip's one press went to *next clue*; flipping Across/Down is the re-tap gesture every crossword app teaches, plus Space and the perpendicular arrow on a keyboard. Discoverable to anyone who has used a crossword app and invisible to anyone who has not. |
| 14 | Is ~16rem of a phone screen too much to give the input panel? | next playtest | Open. It is more than the platform keyboard and its one-row bar took, and it is the price of a layout that never moves — but unlike the keyboard's share it is a number we chose. A 15×15 still gets 19px squares at 320px. A collapse handle is the obvious lever and was deliberately not built ([ADR-0010](adr/0010-one-pinned-input-panel.md)); it is the first thing to revisit if this proves too much. |
