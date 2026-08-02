# PuzzleTogether — Progress

> The first place to look to answer "where are we?" Updated **as part of** the work it tracks, never reconstructed afterward.
>
> Phases and their done-when criteria come from [design-spec.md §13](design-spec.md#13-phases).

**Current phase**: 1 — vertical slice
**Branch**: `feature-puzzletogether`
**Last updated**: 2026-08-02

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
- [ ] Fonts-blocked rendering check (brand.md §7) — not yet run

> **Deviation from [brand.md §3](brand.md#3-color)**: the player palette is now **per theme**. No
> single set of eight can clear 4.5:1 on both cream and charcoal — a colour dark enough for paper
> is too dark for the evening-desk background. Hue separation survived; only lightness moved.

---

## Phase 2 — The full game screen

*Done when: a full session — create, pick, solve, modal, start another — is playable on a phone without touching the console, and the streak increments and resets per [design-spec.md §4](design-spec.md#4-the-game-screen).*

- [ ] Puzzle Select screen (host picks type / difficulty / size)
- [ ] On-screen keypad, sized to the puzzle alphabet, shared input path
- [ ] `Notes | Solve` mode toggle
- [ ] Pencil marks (`marks` op, `--pencil` rendering)
- [ ] `Check` RPC + per-cell result rendering
- [ ] `Reveal` RPC + confirm dialog naming the streak consequence
- [ ] Assist counter per room
- [ ] Per-player forward-only undo
- [ ] Congrats modal — solve time, streak, dismissable, all players
- [ ] Host-only new-puzzle controls in the modal
- [ ] Host-only Back to Puzzle Select (abandons puzzle, resets streak)
- [ ] Streak increment/reset rules wired and tested
- [ ] Dark theme + persisted toggle
- [ ] Mobile layout and touch input
- [ ] Accessibility pass — grid roles, live regions, focus management, reduced motion
- [ ] Grayscale check: players distinguishable without hue

---

## Phase 3 — Nonogram + KenKen

*Done when: both are playable and **adding them required no changes to `shared/` or `<pt-board>`**. If it did, the abstraction is wrong and gets fixed here.*

- [ ] KenKen generator: Latin square → cage partition → op assignment → uniqueness check
- [ ] KenKen time budget / retry cap for larger sizes
- [ ] `<pt-kenken-board>` — cage borders, cage labels
- [ ] Nonogram generator: bitmap → line-solver uniqueness rejection
- [ ] `<pt-nonogram-board>` — clue gutters, tri-state cells
- [ ] Nonogram drag-fill batched into single `fill` ops
- [ ] Keypad slot becomes fill/mark/erase tri-toggle for nonogram
- [ ] **Confirm no `shared/` or `<pt-board>` changes were needed** — if they were, record why and fix the abstraction
- [ ] Visual check of the brand against the mock's actual KenKen layout

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
- [ ] GitHub Actions CI: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
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
| 5 | Does per-cell LWW feel bad in practice? | Phase 2 playtest | Open — soft-lock fallback in [ADR-0001](adr/0001-shared-state-lww-per-cell.md) |
| 6 | Is Lit fast enough for a 25×25 grid? | Phase 1 | **Resolved — yes, comfortably.** 625 cells: 19ms first render, 2.9ms median / 5.3ms p95 single-cell update, 1.7ms presence update. |
| 7 | KenKen uniqueness cost above 7×7 | Phase 3 | Open |
| 8 | Sudoku difficulty targeting misses the requested band ~1% of the time | Phase 2 | Open — the label is always the *measured* rating, so nothing is mislabelled; only the request is occasionally not honoured. |
