# PuzzleTogether — Design Spec

> **Status**: approved · **Branch**: `feature-puzzletogether` · **Last updated**: 2026-08-02
>
> Companion documents: [brand.md](brand.md) · [architecture.md](architecture.md) · [code-style.md](code-style.md) · [adr/](adr/) · [TODO.md](TODO.md)

## Context

PuzzleTogether today is a 2023-era prototype: ~500 lines of vanilla ESM Node + Express + Socket.IO on the server, jQuery template-swapping on the client, no build step, no tests, no persistence. The one implemented game is a Wheel-of-Fortune phrase guesser — the server reveals a letter every 3 seconds and the first correct guess wins.

The goal is a different product: a platform where people create/join a room by short code and **collaboratively solve one shared puzzle grid in real time** — Google-Docs style, with per-player presence and a shared board. Launch puzzle types are sudoku, kenken, nonogram, and crossword, and adding a fifth type later must be cheap.

Nothing in the phrase-guesser survives contact with that product; a server-driven timed-reveal loop and a co-op grid editor share no abstractions. So this is a rebuild that keeps the *instincts* of the prototype (Express + Socket.IO, in-memory rooms, short room codes, host controls) and replaces the implementation.

Decisions already made:

- **Shared-grid co-op**, not a race.
- **Vite + vanilla JavaScript + Lit** web components. No TypeScript.
- **Hybrid puzzle supply**: runtime generators for sudoku/kenken/nonogram, a curated file bank for crossword.
- **In-memory rooms + reconnect tokens.** No database, no accounts.
- **UI follows [`pt_game_mock.png`](pt_game_mock.png)**, with the brand system in [brand.md](brand.md).

---

## 1. Phase 0 — record the design before writing code

Nothing from §5 onward gets implemented until the design is committed and reviewed. Documentation is the first deliverable, not a trailing chore.

```
docs/
├─ design-spec.md          # this document
├─ TODO.md                 # living progress tracker across all phases
├─ brand.md                # §3 expanded: tokens, type scale, do/don't examples
├─ architecture.md         # prose + Mermaid diagrams
├─ code-style.md           # formatting, comment/JSDoc rules, naming, enforcement
├─ pt_game_mock.png        # the UI reference
└─ adr/
   ├─ 0001-shared-state-lww-per-cell.md
   ├─ 0002-in-memory-rooms-no-database.md
   ├─ 0003-lit-and-vanilla-js-over-typescript.md
   ├─ 0004-hybrid-puzzle-supply.md
   ├─ 0005-reconnect-tokens-for-identity.md
   └─ 0006-jsdoc-checkjs-for-type-safety.md
```

Each ADR uses the standard short form — Context / Decision / Consequences / Alternatives rejected — and captures *why*, since every one of these has a plausible-looking alternative that was deliberately declined.

**Diagrams** live in [architecture.md](architecture.md) as **Mermaid** fenced blocks, which GitHub renders natively — no image pipeline, and they stay diffable:

1. **System context / deployment** — browser ↔ Vite (dev) / Express static (prod) ↔ Socket.IO ↔ room store ↔ puzzle provider ↔ generator worker pool + crossword bank.
2. **Room state machine** — `select → playing → solved → select`, with the abandon and new-puzzle transitions and what each does to the streak.
3. **Op lifecycle sequence** — optimistic local apply → emit → server validate/seq/persist → broadcast → echo reconcile, plus the gap-detection → `sync:request` → snapshot path.
4. **Join / reconnect sequence** — token issue, `localStorage`, handshake auth, identity restore, host re-election.
5. **Puzzle module boundary** — the provider seam with `GeneratorProvider` and `BankProvider` behind one interface, showing exactly what a fifth puzzle type must implement.
6. **Client structure** — the Lit component tree and how `RoomStore` reaches it through `StoreController`.

**[code-style.md](code-style.md)** records the conventions before there is code to argue about them over: 4-space indentation, long conditionals split one-per-line, a comment on every function, JSDoc interfaces on every public method, a role comment on every class, plus naming, module boundaries, error handling, and the Lit/CSS rules. It also marks which rules ESLint and Prettier enforce and which only review can — the comment rules are in the second group, and per [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md) they are the ones that decay first in a no-TypeScript codebase.

**[TODO.md](TODO.md)** is the living progress tracker, created in Phase 0 and maintained through every phase after. It carries one checklist section per phase (0–5), mirroring the *done when* criteria in §13, with each item checkable and annotated when blocked or deferred. It is updated as part of the work it tracks — never reconstructed afterward — and it is the first place to look to answer "where are we?"

**Done when**: `docs/` is merged on `feature-puzzletogether` and reviewed. This is the artifact that makes the rest of the work reviewable.

**Phase 0 is the entire current scope.** No implementation code, no scaffolding, no dependency changes — the §2 deletions and everything from §5 onward wait for explicit go-ahead after this documentation is reviewed.

---

## 2. Starting moves (Phase 1, not yet)

Work happens on `feature-puzzletogether` (already carrying `076c176 Small updates`). The prototype stays intact on `main`, so deletion here is free and needs no tagging ceremony.

1. Delete `html/`, `css/`, `js/`, and `js/server/answers.json`. Drop `jquery`, `bootstrap`, and `nodemon` from dependencies.

The phrase guesser could return later as a non-grid game type; it just isn't on the critical path. Carried forward: the socket event vocabulary as a *shape* to imitate, and `shuffle()` from `js/server/utils.js`, which moves into a seeded-RNG module so generated puzzles are reproducible from a seed.

Three bugs in the prototype are requirements-in-disguise; the new design must not reproduce them:

- `disconnect` is an empty stub, so players leak into rooms forever.
- Rooms are never garbage-collected — `js/server/server.js:55` calls `.length` on a plain object, which is always `undefined`.
- Identity is the display-name string, and `isHost` is client-supplied and trusted.

---

## 3. Visual identity

The full system — tokens, type scale, usage rules, and do/don't guidance — lives in **[brand.md](brand.md)**. The summary:

The brand rests on one metaphor: **a printed puzzle page, not a dashboard.** The Sunday puzzle page on good paper — calm, roomy, tactile, quietly playful. Three principles follow:

- **The grid is the loudest thing on screen.** Everything else is deliberately quiet. Chrome earns its ink or it goes.
- **Color belongs to people, not to chrome.** The only saturated elements are player identities and a single accent.
- **Soft chrome, sharp puzzle.** Pills for everything human-facing, hard right angles for the grid. That contrast — already present in the mock — *is* the identity.

Cream paper rather than white, warm near-black ink, no cool gray anywhere. Fraunces (display) + Karla (UI) + DM Mono (room code), self-hosted. Borders instead of shadows. A ~3% graph-paper texture on the background. See [brand.md](brand.md) for values.

---

## 4. The game screen

[`pt_game_mock.png`](pt_game_mock.png) is the layout of record. Top to bottom:

- **Wordmark** — "Puzzle" in `--ink` + "Together" in `--accent`, Fraunces with `WONK`.
- **`Room kqjy`** — DM Mono, `--accent`. **Room codes are 4 lowercase characters.**
- **Players** — pill chips, two per row, each name in that player's color, the host's pill carrying a ★. Disconnected players dim during the grace period before dropping off.
- **Puzzle header** — `**Kenken**: Medium 4x4` (type bold, then difficulty and size).
- **Live solve timer** — mm:ss, counting up.
- **The grid** — heavy cage/region borders, small cage or clue labels in each cell's top-left.
  - **Entered values are large, bold, and `--ink` — not tinted by author.** Attribution is not carried by value color.
  - **Presence is colored dots in the cell's top-right**, one per player focused there; the mock shows two in a single cell. Render up to 3, then `+n`.
  - **Pencil marks** are small `--pencil` digits below the label.
- **`Notes | Solve` segmented toggle** — input mode: pencil marks vs. entering values.
- **`Check` and `Reveal` buttons** — check current entries; reveal the full grid. **Reveal is renamed from the mock's "Solve"** to kill the collision with the input-mode toggle, and it opens a confirm dialog ("Reveal the whole puzzle? This ends your room's solve streak.") because it is destructive and resets the streak.
- **`Back to Puzzle Select`** — **host-only.** Returns the whole room to puzzle select and abandons the current puzzle.
- **Footer** — hairline rule, theme toggle, version line, GitHub link.

Screens: **Landing → Create / Join → Puzzle Select → Game.** "Puzzle Select" replaces the prototype's generic lobby — it is where the host picks type, difficulty, and size while everyone waits, and where the room returns between puzzles.

### On-screen keypad

Number-based puzzles (sudoku, kenken) show a persistent keypad below the grid, NYT-sudoku style: digits `1..n` sized to the puzzle's alphabet, plus delete. It routes through the same op path as physical keyboard input and respects the Notes/Solve mode. It stays visible on desktop, not just touch — it doubles as an affordance showing which digits remain available. Nonogram reuses the slot for a fill / mark / erase tri-toggle; crossword falls back to the native keyboard.

### Completion modal

On server-verified completion, **every player** gets a dismissable congrats modal showing the **solve time** and the **room's solve streak**. The host additionally sees controls to start a new puzzle (type / difficulty / size, defaulting to the one just finished). Dismissing leaves the completed grid on screen; non-hosts wait there until the host starts the next puzzle or returns the room to select.

**Streak semantics**: increments per solved puzzle. Resets to 0 on **Reveal** (full reveal) or on abandoning an unfinished puzzle via Back to Puzzle Select. **Check is free** and never breaks it. The streak lives on the room and dies with it.

---

## 5. Repo layout

```
puzzletogether/
├─ package.json  vite.config.js  jsconfig.json    # checkJs: true
├─ eslint.config.js  .prettierrc
├─ Dockerfile  .env.example  .github/workflows/ci.yml
├─ docs/                       # see §1
├─ data/crosswords/
│  ├─ index.json               # manifest: id, size, difficulty, tags, source, license
│  └─ mini-0001.json …
├─ shared/                     # imported by BOTH server and client
│  ├─ protocol.js              # event constants, PROTOCOL_VERSION, JSDoc typedefs
│  ├─ schema.js                # ~120-line runtime payload validator
│  ├─ constants.js             # player palette, limits, timings
│  ├─ puzzle-doc.js            # idx↔(r,c), entry lookup, cell helpers
│  └─ board-reducer.js         # applyOp() — shared by server and client
├─ server/
│  ├─ index.js  config.js
│  ├─ rooms/{store,lifecycle,codes}.js
│  ├─ net/{handlers,auth,ratelimit}.js
│  └─ puzzles/
│     ├─ provider.js           # getPuzzle({type, difficulty, size}) seam
│     ├─ pool.js               # pre-warmed pools + worker_threads
│     ├─ bank.js               # file-backed provider (crossword)
│     └─ sudoku/  kenken/  nonogram/  crossword/
└─ client/
   ├─ index.html  main.js
   ├─ styles/{tokens.css,base.css}   # the brand system, as custom properties
   ├─ theme.js                       # light/dark, persisted
   ├─ store/{room-store.js,store-controller.js}
   ├─ views/{pt-app,pt-landing,pt-puzzle-select,pt-game,pt-congrats-modal,pt-confirm}.js
   ├─ ui/{pt-player-chips,pt-timer,pt-keypad,pt-mode-toggle}.js
   └─ boards/{pt-board,pt-cell,pt-presence-layer,pt-sudoku-board,…}.js
```

**Dev**: Vite on 5173 with `server.proxy` sending `/socket.io` and `/api` to Express on 3000; `npm run dev` runs both via `concurrently`.
**Prod**: `vite build` → `client/dist`, Express serves it statically. One Node process.

---

## 6. The shared-state model (the core problem)

**Server-authoritative, per-cell last-writer-wins, with a monotonic room-level `seq`.** → [ADR-0001](adr/0001-shared-state-lww-per-cell.md)

Not a CRDT and not OT. Grid cells are independent registers — there is no insertion-ordering problem the way there is in text. When two people type into the same cell, "the later one wins" is both the simplest rule and the one users already expect from shared spreadsheets. Anything fancier is unjustified complexity here.

**Ops** (client → server; server assigns `seq` and rebroadcasts):

```js
{ opId: 'c4f1-7', t: 'set',   cell: 42, value: '5' }
{ opId: 'c4f1-8', t: 'marks', cell: 42, marks: [1,3,7] }   // pencil marks, set semantics
{ opId: 'c4f1-9', t: 'clear', cell: 42 }
{ opId: 'c4f1-a', t: 'fill',  cells: [12,13,14], value: 'x' }  // nonogram drag, batched
```

Server echo adds `{ seq, by: playerId, at }`. Board state is `{ seq, cells: { [idx]: { value, marks, by, seq } } }`. `by` is retained for the solved screen and analytics, **not** for tinting values — color belongs to people, and entered digits are `--ink`.

**Optimistic application.** The client applies its own op immediately, holds it in `pendingOps`, and renders `serverState + pendingOps`. When the echo arrives with a matching `opId`, the op leaves the pending list. If a remote op lands on a cell with a pending local op, the render function resolves it — no rollback machinery, because re-deriving is cheap.

**Gap recovery over op buffering.** Each client tracks the last `seq` it saw. A gap (receives `seq` N+2 while at N) triggers `sync:request` and the server replies with a full snapshot. Snapshots are a few KB, so this is far simpler and more robust than replaying buffered history.

**No hard locks.** Focus is broadcast as presence and rendered as the corner dots. Hard-locking cells in a five-person puzzle is more frustrating than the rare collision it prevents.

**Undo is per-player and forward-only.** Each client keeps a stack of its *own* ops with pre-images. Undo emits a new `set` restoring the prior value — it never rewinds global history. If someone else has since changed that cell, the undo is skipped with a small toast.

**The solution never leaves the server.** `room.solution` sits beside the doc and is never serialized to clients. Check and Reveal are RPCs, both gated by room settings, both incrementing a per-room assist counter, and a full Reveal breaks the streak. This is also what makes "did we actually solve it" server-verified rather than client-claimed.

**Timer.** The server stamps `startedAt` when the puzzle begins and includes it plus its own clock in the snapshot; clients render mm:ss locally against a computed offset, so no timer ticks cross the wire. On solve the server computes the authoritative `elapsedMs` and broadcasts it with `game:solved` — that number, not any client's, is what the modal shows.

**Rate limits.** Focus updates throttled client-side to ~10/s and dropped server-side above that; cell ops capped at ~30/s per player via a token bucket in `server/net/ratelimit.js`.

---

## 7. The puzzle abstraction

One document schema covers all four types. Everything type-specific lives under `meta`.

```js
{
  id: 'kk-8f2a', type: 'kenken', version: 1,
  size: { rows: 4, cols: 4 },
  difficulty: 'medium',
  title: null, author: null, source: 'generated', seed: 918273,
  cells: [ { block: false, given: null, label: null }, … ],  // rows*cols, client-safe
  meta: { … }
}
```

| type | `meta` | cell values |
|---|---|---|
| sudoku | `{ regionRows: 3, regionCols: 3, alphabet: '123456789' }` | digit or null, plus `marks[]` |
| kenken | `{ cages: [{ id, cells: [idx], op: '+|-|*|/|=', target }], alphabet: '1234' }` | digit or null, plus `marks[]` |
| nonogram | `{ rowClues: [[3,1],…], colClues: [[2],…] }` | tri-state `'fill' \| 'x' \| null` |
| crossword | `{ entries: [{ num, dir: 'A'\|'D', cells: [idx], clue, len }] }` | letter or null (rebus deferred) |

**Server module interface** — each `server/puzzles/<type>/index.js` default-exports:

```js
{
  type,
  create({ difficulty, size, rng }) → { doc, solution },
  validateOp(doc, op) → boolean,
  isComplete(doc, board, solution) → boolean,
  checkCells(doc, board, solution, idxs) → { [idx]: 'correct'|'wrong'|'empty' },
}
```

**Provider seam** — `server/puzzles/provider.js` exposes `getPuzzle({ type, difficulty, size })`, backed by `GeneratorProvider` (sudoku/kenken/nonogram) and `BankProvider` (crossword). Identical interface, so a future DB provider drops in with no call-site change. → [ADR-0004](adr/0004-hybrid-puzzle-supply.md)

**Client**: `<pt-board>` owns grid geometry, cell DOM, selection, the presence layer, and op emission. Subclasses supply only cell rendering, the keyboard/keypad map, input filtering, and decorations (cage borders, clue gutters, entry highlighting). A fifth type = one server module + one Lit subclass, touching nothing shared.

---

## 8. Generation

**Sudoku.** Randomized-backtracking solved grid → dig holes symmetrically, checking after each dig that exactly one solution remains (counting solver aborting at 2). Difficulty rated by which techniques a logical solver needs: singles → easy, pairs/pointing → medium, X-wing and beyond → hard. Single-digit to low-tens of milliseconds.

**KenKen.** Random Latin square → flood-fill partition into cages with a size distribution → assign operations (`-` and `/` only for 2-cell cages where they divide evenly) → verify uniqueness with a cage-constraint solver, retrying on failure. Uniqueness verification is the expensive step and the main cost risk at larger sizes. The mock's 4×4 is trivially fast; offer up to 7×7.

**Nonogram.** Random bitmap at a target density (or a small sprite library for recognizable images) → run a line-solver; **reject any puzzle the line-solver can't uniquely resolve**, since ambiguous nonograms are the classic failure mode.

**Latency strategy: pre-warmed pools in a worker thread.** `server/puzzles/pool.js` keeps N ready puzzles per (type, difficulty, size), refilled in the background via `node:worker_threads` so generation never blocks the event loop — which matters most when the host hits "new puzzle" from the congrats modal and expects it instantly. `getPuzzle` pops from the pool, falling back to synchronous generation only if dry.

**Crossword bank.** `data/crosswords/index.json` manifest plus one JSON per puzzle, validated at boot. Seed with hand-authored minis, plus `scripts/import-crossword.js` to convert `.puz`/`.ipuz`. Auto-generated crossword clues are poor, which is exactly why this type is banked rather than generated.

---

## 9. Rooms, identity, lifecycle

**Room codes**: **4 lowercase characters** from an unambiguous alphabet (no `l`/`o`), collision-checked properly against the room map — fixing `generateUniqueRoomCode`, which currently tests `roomID in Object.keys(...)` and so checks array *indices*, never codes. Four chars from ~24 letters is ~330k combinations: plenty for concurrent rooms, small enough that collision checking is mandatory rather than optional.

**Reconnect tokens**: on first join the server issues an opaque 32-byte hex `playerToken`, stored in `localStorage` and sent in the Socket.IO handshake `auth`. The server maps `token → playerId` per room; reconnecting restores name, color, and host status and re-attaches the socket. Chips dim for a ~2 minute grace period before a player is dropped; identity survives for the room's lifetime. → [ADR-0005](adr/0005-reconnect-tokens-for-identity.md)

```js
room = {
  code, state: 'select' | 'playing' | 'solved',
  hostId, createdAt, lastActivityAt,
  settings: { type, difficulty, size, checkingAllowed, revealAllowed },
  players: Map(playerId → { name, color, socketId|null, connected, joinedAt }),
  streak: 0,
  doc, solution, board: { seq, cells }, startedAt, assists: 0,
  timers: Set,
}
```

**Colors** come from the brand palette in `shared/constants.js`, assigned round-robin and released on leave.

**Host**: first joiner. On host disconnect past the grace window, promote the longest-connected player. Every host-only action — `game:start`, `game:newPuzzle`, `room:backToSelect`, `room:kick`, `room:settings`, grid-scope `game:reveal` — is authorized server-side against `playerId === room.hostId`. The client's `isHost` controls only whether the ★ and host buttons render.

**GC**: a 60-second sweep deletes rooms with zero connected players for >10 minutes, or total age >12 hours, clearing every timer in `room.timers` first.

---

## 10. Socket protocol

Client → server, all with acks of the form `cb({ ok: true, data }) | cb({ ok: false, error: { code, message } })`:

`room:create`, `room:join`, `room:leave`, `room:kick`, `room:settings`, `room:backToSelect`, `game:start`, `game:newPuzzle`, `game:op`, `game:focus`, `game:check`, `game:reveal`, `sync:request`

Server → client:

`room:state`, `room:players`, `room:host`, `game:started`, `game:snapshot`, `game:op`, `game:focus`, `game:checkResult`, `game:solved`, `error`

```js
// game:solved
{ elapsedMs: 103_000, streak: 4, assists: 1, revealed: false,
  board: { seq, cells } }   // final board, so late joiners see the solved grid
```

**Keeping payloads honest without TypeScript**: `shared/protocol.js` holds event constants, `PROTOCOL_VERSION`, and JSDoc `@typedef`s for every payload. `shared/schema.js` is a small declarative runtime validator applied to every inbound payload at the server boundary — the server must never trust client shapes. `jsconfig.json` with `checkJs: true` turns the JSDoc into real editor-level type checking across client and server, with zero `.ts` files. → [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md)

The handshake carries `PROTOCOL_VERSION`; a major mismatch returns a "please refresh" error rather than mysterious breakage after a deploy.

---

## 11. Client architecture

- `<pt-app>` root with a tiny hash router: `#/` → landing, `#/room/kqjy` → puzzle select or game, driven by `room.state`.
- **One `RoomStore`** (plain observable class) owns the socket, room state, board state, pending ops, and timer offset. Components never hold sockets. A Lit `ReactiveController` (`StoreController`) subscribes any element to the slices it needs.
- **Rendering perf** is the thing to get right early. Cells render once as `<pt-cell>` elements keyed by index via `repeat()`; per-cell updates mutate that element's reactive properties directly rather than re-rendering the grid. Presence dots live in a separate `<pt-presence-layer>` overlay, so focus traffic never touches cell DOM. Verify on a 25×25 nonogram in Phase 1, not Phase 3.
- **Input** flows through one path regardless of source — physical keyboard, on-screen keypad, or touch — branching on the Notes/Solve mode. Crossword adds Tab/Enter direction toggle, auto-advance, and entry highlighting; nonogram adds drag-fill batched into one `fill` op.
- **Theme**: `data-theme` on `<html>` plus the brand custom properties; the footer toggle persists to `localStorage`, initial value respects `prefers-color-scheme`.
- **Accessibility**: `role="grid"`/`gridcell`, aria-labels carrying clue and cage text, a live region for presence changes and completion, managed focus, `prefers-reduced-motion` honored, and presence conveyed by name as well as dot color — never color alone.

---

## 12. Testing, tooling, CI

**Vitest** — Vite is already in the stack, so one config, with jsdom for Lit component tests.

Highest-value targets, in order:

1. **Generator invariants** (property-style): 200 puzzles per type, asserting exactly one solution, stable difficulty rating, and for nonogram that the line-solver resolves it.
2. **Board reducer**: op ordering under LWW, and the key equivalence — sequential op application equals the snapshot.
3. **Protocol schema validation**: malformed payloads rejected, never crashing a handler.
4. **Room lifecycle**: reconnect-token restore, host election on disconnect, streak increment/reset rules, GC deleting rooms and clearing timers.
5. **Bank loader**: every file in `data/crosswords/` validates against the schema.

ESLint flat config + Prettier, both configured to the conventions in [code-style.md](code-style.md). CI on GitHub Actions, Node 22: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`.

Deployment is a single Node process with a Dockerfile and `PORT`/`NODE_ENV`. Multi-instance later means `@socket.io/redis-adapter` plus moving rooms out of process memory — noted in [ADR-0002](adr/0002-in-memory-rooms-no-database.md), not built now.

---

## 13. Phases

Phase 1 is a vertical slice deliberately, not scaffolding — the co-op sync model is the risky part and should be proven with one puzzle type before the others exist. Progress is tracked in [TODO.md](TODO.md).

**Phase 0 — documentation.** Per §1. *Done when*: `docs/` merged and reviewed.

**Phase 1 — vertical slice.** Re-scaffold to Vite + Lit + Express + Socket.IO; the brand token system; `shared/` protocol, schema, reducer; rooms with 4-char codes, reconnect tokens, host authorization, GC; sudoku generator + pool; the mock's layout (wordmark, room code, player chips with host ★, puzzle header, timer, grid); `<pt-sudoku-board>` with presence dots; optimistic ops with echo and gap recovery; server-verified solve detection.
*Done when*: two browsers in one room edit the same sudoku live with visible presence dots, one refreshes mid-solve and returns with name/color/host intact, and completing the grid triggers solve detection.

**Phase 2 — the full game screen.** On-screen keypad, Notes/Solve toggle, pencil marks, Check and Reveal (with confirm dialog) plus assist counting, per-player undo, congrats modal with time + streak, host new-puzzle controls, host-only Back to Puzzle Select, the Puzzle Select screen, dark theme, mobile input, a11y pass.
*Done when*: a full session — create, pick, solve, modal, start another — is playable on a phone without touching the console, and the streak increments and resets per §4.

**Phase 3 — nonogram + kenken.** The real test of §7. KenKen is what the mock depicts, so this is also when the visual design gets its truest check.
*Done when*: both are playable and **adding them required no changes to `shared/` or `<pt-board>`**. If it did, the abstraction is wrong and gets fixed here.

**Phase 4 — crossword + bank.** Bank format, loader, validator, `.puz`/`.ipuz` importer, clue-list UI, direction toggle, entry highlighting.
*Done when*: a 15×15 puzzle is co-op solvable with synchronized clue-list state.

**Phase 5 — hardening.** Tests to meaningful coverage, CI green, Dockerfile, rate limits, load test with N simulated players in one room.

Docs are updated *within* each phase, not after — an ADR that no longer matches the code is worse than no ADR.

---

## 14. Risks and open questions

- **Crossword content licensing is the real blocker for Phase 4.** Which puzzles can legally ship? Hand-authored minis and public-domain sources are the safe start; needs a decision before Phase 4.
- **KenKen uniqueness verification cost** grows sharply with grid size. The pre-warm pool hides latency, but sizes above ~7 may need a time budget and retry cap.
- **LWW may feel bad** if two players fight over one cell. Presence dots should make it rare; if playtesting disagrees, the fallback is a short soft-lock on focused cells — deliberately not built now.
- **Shared-document undo is inherently surprising.** Per-player forward-only is the best available answer; expect tuning after real play.
- **Lit per-cell update performance** on large grids is the main frontend unknown. Prove it in Phase 1.
- **The streak is room-scoped and dies with the room** (no persistence, by decision). Surviving an empty room would mean revisiting the no-database decision.
- **Fraunces `WONK` and the paper texture are the two brand elements most likely to divide opinion.** Both are one-line reversions; decide on real screens in Phase 1 rather than in the abstract.

---

## Verification

- **Co-op sync**: `npm run dev`, two browsers, create + join, type into the same cell from both — last writer wins in both views, presence dots track, no desync. Kill one client's network briefly and confirm gap recovery via `sync:request` snapshot.
- **Reconnect**: hard-refresh mid-solve; identity, color, host status, board state, and elapsed timer all return correctly.
- **Solution secrecy**: inspect every socket frame in devtools — no payload contains solution values before completion.
- **Completion flow**: solve in two browsers; both get the modal with the same server-computed time, only the host sees new-puzzle controls, streak increments. Repeat via Reveal (confirming the dialog) and verify it resets to 0.
- **Room GC**: shorten the sweep interval in config, leave a room empty, confirm deletion and timer cleanup.
- **Generators**: `npm test` runs the uniqueness property tests; failures block everything downstream.
- **Brand**: check both themes at 320px and 1440px, run contrast on every token pair, and confirm the app renders correctly with fonts blocked (no layout shift, no invisible text).
- **Full check**: `npm run lint && npm test && npm run build`, then run the production build as a single process and replay the co-op scenario against it.
