# PuzzleTogether — Progress

> The first place to look to answer "where are we?" Updated **as part of** the work it tracks, never reconstructed afterward.
>
> Phases and their done-when criteria come from [design-spec.md §13](design-spec.md#13-phases).

**Current phase**: 0 — documentation
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
- [ ] Reviewed
- [ ] Merged

---

## Phase 1 — Vertical slice

*Done when: two browsers in one room edit the same sudoku live with visible presence dots, one refreshes mid-solve and returns with name/color/host intact, and completing the grid triggers solve detection.*

**Teardown & scaffold**
- [ ] Delete `html/`, `css/`, `js/`, `js/server/answers.json`
- [ ] Drop `jquery`, `bootstrap`, `nodemon` from `package.json`
- [ ] Vite + Lit + Express + Socket.IO scaffold; dev proxy 5173 → 3000
- [ ] `jsconfig.json` with `checkJs: true`; `npm run typecheck`
- [ ] ESLint flat config + Prettier, configured to [code-style.md](code-style.md) (4-space indent, 100 cols, `shared/` import direction)
- [ ] Brand tokens as `client/styles/tokens.css` (light theme only this phase)
- [ ] Self-hosted fonts via `@fontsource` (Fraunces, Karla, DM Mono)

**Shared**
- [ ] `shared/protocol.js` — event constants, `PROTOCOL_VERSION`, JSDoc typedefs
- [ ] `shared/schema.js` — runtime payload validator
- [ ] `shared/board-reducer.js` — `applyOp()`, imported by both sides
- [ ] `shared/constants.js` — player palette, limits, timings
- [ ] `shared/puzzle-doc.js` — index/coordinate helpers

**Rooms**
- [ ] 4-char lowercase room codes with correct collision checking
- [ ] Reconnect tokens: issue, `localStorage`, handshake auth, identity restore
- [ ] Disconnect grace period (~2 min) with dimmed chips — no more leaked players
- [ ] Host election + server-side authorization on every host-only event
- [ ] Room GC sweep; all timers cleared on delete
- [ ] Rate limiting (token bucket) on ops and focus

**Sudoku**
- [ ] Solved-grid generator (randomized backtracking, seeded)
- [ ] Uniqueness-checking counting solver (aborts at 2 solutions)
- [ ] Difficulty rating via solving techniques
- [ ] `puzzles/provider.js` seam + `pool.js` pre-warm in `worker_threads`
- [ ] Module interface: `create` / `validateOp` / `isComplete` / `checkCells`

**Client**
- [ ] `RoomStore` + `StoreController`
- [ ] `<pt-app>` hash router; landing / create / join
- [ ] Mock layout: wordmark, room code, player chips with host ★, puzzle header, timer
- [ ] `<pt-board>` base + `<pt-sudoku-board>`
- [ ] `<pt-cell>` with keyed single render; per-cell property updates
- [ ] `<pt-presence-layer>` — corner dots, up to 3 then `+n`
- [ ] Optimistic ops, echo reconcile, `seq` gap → `sync:request` → snapshot
- [ ] Server-verified solve detection

**Verify**
- [ ] Two browsers edit the same cell — LWW resolves identically in both
- [ ] Hard refresh mid-solve restores identity, color, host, board, timer
- [ ] No socket frame contains solution values (devtools check)
- [ ] 25×25 grid renders and updates smoothly — the perf unknown from ADR-0003
- [ ] `--accent` / player-palette contrast script passes (see [brand.md §7](brand.md#7-verification))

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
| 2 | Does Fraunces `WONK` survive contact with real screens? | Phase 1 | Open — judge on screen, not in the abstract |
| 3 | Does the paper texture read as subtle or as noise? | Phase 1 | Open — same |
| 4 | Can 8 player colors all clear AA on cream, or drop to 6? | Phase 1 | Open — run the contrast script |
| 5 | Does per-cell LWW feel bad in practice? | Phase 2 playtest | Open — soft-lock fallback in [ADR-0001](adr/0001-shared-state-lww-per-cell.md) |
| 6 | Is Lit fast enough for a 25×25 grid? | Phase 1 | Open — fallback in [ADR-0003](adr/0003-lit-and-vanilla-js-over-typescript.md) |
| 7 | KenKen uniqueness cost above 7×7 | Phase 3 | Open |
