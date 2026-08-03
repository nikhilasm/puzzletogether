# PuzzleTogether — Design Spec

> **Status**: approved · **Branch**: `feature-puzzletogether` · **Last updated**: 2026-08-03
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
- **Soft chrome, sharp puzzle.** Softened rectangles for everything human-facing, hard right angles for the grid. That contrast — already present in the mock — *is* the identity.

Cream paper rather than white, warm near-black ink, no cool gray anywhere. Fraunces (display) + Karla (UI) + DM Mono (room code), self-hosted. Borders instead of shadows. A ~3% graph-paper texture on the background. See [brand.md](brand.md) for values.

---

## 4. The game screen

[`pt_game_mock.png`](pt_game_mock.png) is the layout of record. Top to bottom:

- **Wordmark** — "Puzzle" in `--ink` + "Together" in `--accent`, Fraunces with `WONK`.
- **`Room kqjy`** — DM Mono, `--accent`. **Room codes are 4 lowercase characters.**
- **Players** — `x/n` above chips, two per row, each name in that player's color, the host's chip carrying a leading ★ and your own a trailing quiet `you`. Disconnected players dim during the grace period before dropping off.
  - **Your own chip is a button**: it opens a palette of the eight colors, with the ones other players hold greyed and struck through — shown rather than hidden, so you can see what the room already holds. Color is the only piece of identity a player can change, so it is edited where it is shown rather than behind a settings screen, and the server, not the disabled attribute, is what enforces uniqueness.
  - **The host gets a remove control on everybody else's chip**, behind a confirm dialog. It is the one action in the app done *to* another person, which is why it is confirmed and why it is host-only. The removed player lands back on the landing screen with the reason on screen; nothing stops them rejoining with the code, because there are no accounts to ban.
- **Puzzle header** — `**Kenken**: Medium 4x4` (type bold, then difficulty and size).
- **Live solve timer** — mm:ss, counting up.
  - Header and timer are set at `--text-lg` and sit tight to the grid, reading as its caption rather than as a banner over it. They are the same size as each other by design: weight separates them, so nothing on the screen competes with the grid for first place.
- **The grid** — heavy cage/region borders, small cage or clue labels in each cell's top-left.
  - **Entered values are large, bold, and `--ink` — not tinted by author.** Attribution is not carried by value color.
  - **Presence is colored dots in the cell's top-right**, one per player focused there; the mock shows two in a single cell. Render up to 3, then `+n`. The overlay declares **both grid axes**: with only its columns named, every row past the first was an implicit track sized to its dot, and a dot below the top row landed nowhere near its cell.
  - **Pencil marks** are small `--pencil` digits, each in the fixed slot its digit always occupies, in a mark grid that also declares **both axes** — for the same reason, and because a mark that moves when its neighbours change defeats the point of fixed slots.
  - **The grid is opaque.** The page's graph-paper texture is the surface the puzzle sits *on*; showing through the cells it read as a second, unaligned ruling inside the real one. The background sits on the frame, so the selection and stroke washes still composite over one flat backdrop rather than over a colour of their own.
  - **Every cell is the same box, whatever borders it carries.** Cells are `border-box` with 1px hairlines throughout, and region rules are drawn as an overlay on top rather than as a heavier border. As a border, the heavy rule changed the cell's geometry (visible in Firefox as a 1px row misalignment, which Chromium rounded away) and mitred with the hairline on the adjoining edge, cutting a pale notch across the rule at every crossing.
- **`Notes` switch** — input mode: pencil marks vs. entering values. **Revised in Phase 2** from the mock's `Notes | Solve` segmented pair to a single labelled switch, and moved to sit directly above the keypad. Two segments implied two independent things to choose between when there is really one setting, of which Solve is simply the off state — and the control belongs with the digits whose meaning it changes, not down among Check and Reveal.
- **`Check` and `Reveal` buttons** — check current entries; reveal the full grid. **Reveal is renamed from the mock's "Solve"** to kill the collision with the input-mode toggle, and it opens a confirm dialog ("Reveal the whole puzzle? This ends your room's solve streak.") because it is destructive and resets the streak.
- **`Puzzle Select`** — **host-only.** Returns the whole room to puzzle select and abandons the current puzzle. Labelled as its destination, matching the congrats modal's button for the same action.
- **The notice line** — one italic `--graphite` line under the keys, for the things a player does that the grid cannot answer by itself: `pick a square first`, `checked — 2 wrong`, `that cell has changed since — undo skipped`. It is a `role="status"` live region that stays in the DOM empty, because a region announced into has to exist before the text arrives, and it takes **no height at all** while empty — an empty block has no line box, and its margins hang off `:not(:empty)` so they arrive with the words.
- **The puzzle-action row** — `Puzzle Select · Check · Reveal`, one row under a hairline, each with an icon. **Scope is what divides the controls, not frequency.** Erase and Undo stay on the keypad because they act on the cell you are in; these three act on the room's whole puzzle and two of them are host-only, so nobody reaches for Undo and lands on Reveal. The row renders only the actions a given player has, and disappears entirely rather than leaving a rule drawn under nothing.
- **`Leave room`** — on this screen and on Puzzle Select both, quiet and last. Leaving is not something you should have to abandon a puzzle to do.
- **Footer** — hairline rule, `Dark theme` switch, version line, GitHub link.

Actions are buttons and settings are switches — see [brand.md §4](brand.md) for why the distinction is kept literal, and for the icon and focus-ring rules that go with it.

Screens: **Landing → Create / Join → Puzzle Select → Game.** "Puzzle Select" replaces the prototype's generic lobby — it is where the host picks type, difficulty, and size while everyone waits, and where the room returns between puzzles. It also carries the room's only **`Leave room`** button, set quietly below the host's controls.

**A choice can be offered and still carry a caveat.** A 20×20 nonogram is a good puzzle on a laptop and a cramped one on a phone, so the option wears a small warning triangle and, once picked, explains itself in a line beneath the row. It is not disabled: the host may well be on a laptop, and the point is that they are often *the one person in the room who cannot see the problem*. Two rules follow from the brand — the note is `--graphite` like every other note and never `--wrong`, because nothing has gone wrong; and the triangle rides in the option's accessible name as well, because a bare triangle says only that *something* is the matter. A type also **defaults to its largest uncautioned size**, since landing the host on the size the picker warns about would be an odd thing to warn about.

### Landing

Two **tabs** — `Create` and `Join` — over a single form. Create asks for a name; Join asks for a name and a room code. The tabs are set as **text over a shared rule**, not as a pair of buttons: they name which half of the form you are looking at rather than offering two actions, and boxed they competed with the button that actually does something. **Revised in Phase 2**: showing both paths at once meant two buttons and three fields on screen with nothing saying which button the code field belonged to, and the first thing a new visitor has to do should not be a puzzle. The name input is rendered once, outside the branch, so changing tabs does not lose what you typed. Arriving on a room URL without a seat opens the Join tab with the code filled in, because that is the question that visitor was already asking.

### On-screen keypad

Number-based puzzles (sudoku, kenken) show a persistent keypad below the grid, NYT-sudoku style: digits `1..n` sized to the puzzle's alphabet, plus delete. It routes through the same op path as physical keyboard input and respects the Notes/Solve mode. It stays visible on desktop, not just touch — it doubles as an affordance showing which digits remain available. Crossword falls back to the native keyboard.

**Undo sits in this row too**, beside Erase, rather than with Check and Reveal. The mock has no Undo control, and Ctrl+Z is not a thing a phone has — so it needed a button, and putting it with Erase keeps every way of changing a cell in one place. Ctrl+Z still works when the grid has keyboard focus.

The block reads **Notes switch → digits → Erase / Undo**, so everything that decides what a keypress means sits above the keys, and everything that undoes one sits below.

**Nonogram takes the same slot with `Fill · Cross · Erase`** — a tri-toggle, because picking a brush changes what the grid does next rather than changing the grid, the same distinction that makes Notes a switch and Check a button. It replaces *both* the Notes switch and the digits: a nonogram has no digits to press, and no pencil marks either, because the cross **is** the note. Three mutually exclusive states is one more than a switch can hold, so it borrows the `aria-pressed` option-group pattern from the puzzle pickers.

**Erase leaves the row for nonogram, Undo never does.** Erase clears the selected cell — the counterpart to pressing a digit into it — so a puzzle with no digits has no use for it, and nonogram erases by dragging with its erase brush. Undo belongs to every type there will ever be.

**A tap paints one square and a drag paints a run**, batched into a single `fill` op on release. What the whole stroke will write is decided from its first square: starting on a square that already holds what the brush paints means the stroke *erases*, so one gesture covers both painting a run and taking it back, and a mis-tap is undone by tapping again. Deciding per square would leave a checkerboard behind. The drag locks to the row or column it started along, because nonogram runs are straight and an unlocked drag on a phone paints whatever the thumb wandered over. One drag is also **one press of Undo** — five presses to walk back one gesture would make the control useless on a 20×20.

**The run is washed in the accent as the drag covers it, before anything is committed.** A stroke lands on release, so without this the grid says nothing until the gesture is over — and laying a run of a particular length against a clue is the entire reason to drag rather than tap. The wash is deeper than the selected cell's, because it has to stay legible over the marks already in the run, and it gives way to the marks themselves in the same frame the op is applied optimistically. `isHighlighted` is the `<pt-board>` hook behind it, and it is the same one crossword will use to highlight the entry under the cursor.

**A filled square fills its whole cell.** Adjacent fills then meet, so a run reads as one bar the length of its clue — which is the thing a solver is counting. Inset blocks read as a row of separate dots that have to be counted one at a time. The hairlines still draw over the top, so the grid is a grid.

**Nonogram draws a heavier rule every five squares.** It divides nothing — a nonogram has no regions — but matching a clue of 7 to a run of squares is guesswork on an unmarked 20×20 and immediate on a grid banded in fives. The bands are the **hairline's colour at three times its weight**, not `--ink`: in the fill colour they read as filled squares that happen to be thin, competing with the picture they exist to help measure. The outer frame keeps its `--ink` edge in every type.

### Completion modal

On server-verified completion, **every player** gets a dismissable congrats modal showing the **solve time** and the **room's solve streak**. The host additionally sees controls to start a new puzzle (type / difficulty / size, defaulting to the one just finished). Dismissing leaves the completed grid on screen; non-hosts wait there until the host starts the next puzzle or returns the room to select.

**Streak semantics**: increments per solved puzzle. Resets to 0 on **Reveal** (full reveal) or on abandoning an unfinished puzzle via Back to Puzzle Select. **Check is free** and never breaks it. The streak lives on the room and dies with it.

---

## 5. Repo layout

```
puzzletogether/
├─ package.json  vite.config.js  jsconfig.json    # checkJs: true
├─ eslint.config.js  .prettierrc  playwright.config.js
├─ tests/                      # Playwright: the app in a real browser, two clients (§12)
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
│  ├─ rooms/{store,lifecycle,codes,progress}.js
│  ├─ net/{handlers,auth,ratelimit}.js
│  └─ puzzles/
│     ├─ provider.js           # getPuzzle({type, difficulty, size}) seam
│     ├─ pool.js               # pre-warmed pools + worker_threads
│     ├─ value-grid.js         # isComplete/checkCells for one-value-per-cell types
│     ├─ bank.js               # file-backed provider (crossword)
│     └─ sudoku/  kenken/  nonogram/  crossword/
└─ client/
   ├─ index.html  main.js
   ├─ styles/{tokens.css,base.css,controls.js}   # the brand system, as custom properties
   ├─ theme.js                       # light/dark, persisted
   ├─ store/{room-store.js,store-controller.js,ops.js,undo-stack.js}
   ├─ views/{pt-app,pt-landing,pt-puzzle-select,pt-game,pt-congrats-modal,pt-confirm}.js
   ├─ ui/{pt-player-chips,pt-timer,pt-keypad,pt-mode-toggle,pt-brush-bar,pt-switch,pt-puzzle-picker,icons}.js
   └─ boards/{registry,pt-board,pt-cell,pt-presence-layer,pt-sudoku-board,pt-kenken-board,pt-nonogram-board}.js
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

**A cell holds a value or marks, never both** (settled in Phase 2). A `set` clears the cell's marks — they were notes toward it — and a `marks` op clears the value. This is how a cell already rendered, and it is what makes a cell's entire state expressible in a single op, which is what lets undo restore any earlier state with one write rather than a pair of them. Without it, undoing back to a marks-only state silently left the old digit in place.

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
| nonogram | `{ rowClues: [[3,1],…], colClues: [[2],…], values: { fill: '#', cross: 'x' } }` | tri-state `'#' \| 'x' \| null`, no `marks[]` |
| crossword | `{ entries: [{ num, dir: 'A'\|'D', cells: [idx], clue, len }] }` | letter or null (rebus deferred) |

**Nonogram's two values are single characters, and it names them in its own `meta`.** Single characters because `schema.js` bounds every cell value at one, and that rule holds for four types precisely because no type has been allowed to widen it. Named in `meta` rather than agreed as a shared constant because the board is then reading *what this puzzle uses* rather than knowing what nonograms use — the same reason sudoku's alphabet travels in the document.

**Nonogram has no pencil marks**: the cross *is* the note, so it lives in the cell's value and `marks[]` stays empty. This is also why nonogram is the one type whose `isComplete` cannot be the shared value-grid comparison — a grid is solved by its **filled** squares alone, whether the player marked the blanks, marked them wrongly, or left them alone.

**KenKen labels its cages through `DocCell.label`**, which already draws in a cell's top-left corner. The server writes `12+` or `3÷` onto each cage's first cell and the board never mentions labels at all.

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

The subclass hooks, settled in Phase 3 when two new types actually pulled on them:

| hook | answers | used by |
|---|---|---|
| `isHeavyRight` / `isHeavyBottom` | where the heavy rules go | sudoku regions, kenken cages, nonogram's counting bands |
| `valueForKey` | what a keystroke writes here | all |
| `markColumns` / `markRows` | how pencil marks lay out | sudoku, kenken |
| `valueGlyphs` | whether a value is drawn as a character or as a mark | nonogram |
| `renderTopGutter` / `renderSideGutter` | what is drawn alongside the grid, aligned to its tracks | nonogram |
| `isHighlighted` | which cells the gesture in progress covers, as distinct from the selection | nonogram drags; crossword entries |

**The board element for a type, and the kind of input it takes, are declared in `client/boards/registry.js`.** The game screen branches on the *input style* — `digits`, `brushes`, and `native` for the crossword to come — never on the type name. Sudoku and kenken share `digits` despite having nothing else in common, which is the point: there are far fewer ways to put something in a cell than there are puzzles.

---

## 8. Generation

**Sudoku.** Randomized-backtracking solved grid → dig holes symmetrically, checking after each dig that exactly one solution remains (counting solver aborting at 2). Difficulty rated by which techniques a logical solver needs: singles → easy, pairs/pointing → medium, X-wing and beyond → hard. Single-digit to low-tens of milliseconds.

**KenKen.** Random Latin square → flood-fill partition into cages with a size distribution → assign operations (`-` and `/` only for 2-cell cages where they divide evenly) → verify uniqueness with a cage-constraint solver. Uniqueness verification is the expensive step and the main cost risk at larger sizes. Sizes 4–7 are offered; measured cost is ~1ms at 5×5 and ~170ms median / 870ms worst at a 7×7 hard, which the pre-warm pool absorbs.

A partition that is *not* unique is **tightened rather than redrawn**: the largest cage is split in two and the solver asked again. This is the opposite direction from sudoku, which starts from a full grid and removes information — and it is what makes generation total. Splitting far enough leaves every cell in a cage of its own, where each clue simply names its digit, so the loop cannot fail to terminate; at worst it terminates on an easier puzzle than was asked for. The time budget and retry cap bound the search for a puzzle that needed *no* splitting, not whether one is produced.

**KenKen's difficulty is a generation parameter, not a measurement** — the one place the platform knowingly departs from "the label is the measured rating". Cage sizes and the operation mix are drawn per difficulty, and `doc.difficulty` is what was asked for. Rating a KenKen honestly would need a technique-ranked cage solver, which is the same expensive search that already dominates generation. Single-cell cages are free digits, so how many a puzzle may keep is capped explicitly (8% of cells at easy, 2% at medium, none at hard) rather than left to the size distribution — cage growth *strands* singletons whatever the distribution asks for, and unchecked that put nine free digits in a 7×7 easy.

**Nonogram.** Random bitmap at a target density → clue it → run a line-solver; **reject any puzzle the line-solver can't uniquely resolve**, since ambiguous nonograms are the classic failure mode. Random bitmaps rather than recognizable pictures for now: `drawBitmap` is the seam a sprite library drops into, and a hand-drawn sprite would face exactly the same rejection. Cells are drawn independently rather than in blobs — clustered pixels make a prettier picture and longer runs, and long runs are what the overlap deduction eats first, so blob-drawn grids came out uniformly easy.

**Nonogram's difficulty is measured**, by the same solver that proves it fair: sweeping rows and columns until nothing changes is what a person does, so *how many sweeps it took* is a property of the puzzle rather than a parameter fed into it. The last sweep is not counted — it deduces nothing, it is only how the loop learns it has finished — and counting it would put a floor of two under every puzzle, which no small grid could ever fall below. Density steers the search toward the band requested; the label is what the puzzle earned. Thresholds are a fraction of the grid's side (0.3 medium, 0.45 hard), normalized because information travels one row and one column per sweep, so an absolute threshold would call every large grid hard and every small one easy.

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

`room:create`, `room:join`, `room:leave`, `room:kick`, `room:settings`, `room:backToSelect`, `player:color`, `game:start`, `game:op`, `game:focus`, `game:check`, `game:reveal`, `sync:request`

Repo layout: unit tests sit beside their modules; `tests/` at the root holds the Playwright suite (§12).

Server → client:

`room:state`, `room:players`, `room:host`, `game:started`, `game:snapshot`, `game:op`, `game:focus`, `game:checkResult`, `game:solved`, `error`

**`game:newPuzzle` was folded into `game:start`** in Phase 2. Starting from `select` and starting again from `solved` differ in nothing but the state they leave, so the second event would have been a second thing to keep in step with the first for no gain. `room:settings` is still unimplemented — nothing so far needs it.

**`room:kick` is host-only and takes a `playerId`.** The removed player is told before their seat is dropped — once it is gone there is nothing left to tell them about — via a `KICKED` error, which is the one error a client receives without having asked for anything. Their reconnect token dies with the seat, so it cannot be used to walk back in; the room code still can, because there are no accounts here and a kick is a nudge rather than a ban.

**`player:color` carries a palette index and nothing else.** A seat only ever speaks for itself, so there is no target player in the payload — you cannot recolour anybody else, and the handler needs no authority check beyond "you hold a seat". The server refuses an index another player holds: a room's colours must stay unique, because presence dots are the one place identity is carried by hue with no name beside it. The answer comes back as a `room:players` broadcast rather than an ack payload, since the client cannot know what the rest of the room holds.

**`game:check` grades the whole grid and its result is broadcast to the room**, not returned privately to the caller. Assists are counted per room, so a check is something the room did rather than something one player did quietly — and a check with no cell list is one a client cannot use to interrogate the solution a cell at a time. `game:reveal` is grid-scope and host-only; there is no cell-scope reveal.

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
- **The route owns the seat.** Navigating away from a room releases it — back button, wordmark, and the `Leave room` button are all the same path, so they cannot drift apart, and no player can sit on the landing screen while the room still lists them as present. A reload is deliberately *not* this path: it fires no `hashchange`, so a refresh mid-solve still restores from the reconnect token. The room header and roster render only on the room route, so nothing of a room survives on screen after leaving one.
- **One `RoomStore`** (plain observable class) owns the socket, room state, board state, pending ops, and timer offset. Components never hold sockets. A Lit `ReactiveController` (`StoreController`) subscribes any element to the slices it needs.
- **Rendering perf** is the thing to get right early. Cells render once as `<pt-cell>` elements keyed by index via `repeat()`; per-cell updates mutate that element's reactive properties directly rather than re-rendering the grid. Presence dots live in a separate `<pt-presence-layer>` overlay, so focus traffic never touches cell DOM. Verify on a 25×25 nonogram in Phase 1, not Phase 3.
- **Input** flows through one path regardless of source — physical keyboard, on-screen keypad, or touch — branching on the Notes/Solve mode. Crossword adds Tab/Enter direction toggle, auto-advance, and entry highlighting; nonogram adds drag-fill batched into one `fill` op.
- **Theme**: `data-theme` on `<html>` plus the brand custom properties; the footer switch persists to `localStorage`, initial value respects `prefers-color-scheme`, and an inline bootstrap in `index.html` applies it before first paint so a dark-preferring visitor never sees a flash of cream.
- **Shared styling** lives in `client/styles/controls.js` as `css` fragments each component composes into its own `static styles`. Shadow roots inherit properties, not rules, so anything that must be consistent app-wide — the focus ring above all — has to be *distributed*, not declared once globally.
- **Accessibility**: `role="grid"`/`gridcell`, aria-labels carrying clue and cage text, a live region for presence changes and completion, managed focus, `prefers-reduced-motion` honored, and presence conveyed by name as well as dot color — never color alone. Settings are `role="switch"` so their state is announced as a state; the landing tabs follow the `tablist` pattern, including arrow-key movement; every color swatch is labelled with its color's name; icons are decorative and `aria-hidden`, never the only carrier of meaning.

---

## 12. Testing, tooling, CI

Two suites, split by what they can actually see.

**Vitest** (`npm test`) for logic — pure modules, no DOM. Highest-value targets, in order:

1. **Generator invariants** (property-style): 200 puzzles per type, asserting exactly one solution, stable difficulty rating, and for nonogram that the line-solver resolves it.
2. **Board reducer**: op ordering under LWW, and the key equivalence — sequential op application equals the snapshot.
3. **Protocol schema validation**: malformed payloads rejected, never crashing a handler.
4. **Room lifecycle**: reconnect-token restore, host election on disconnect, colour uniqueness, streak increment/reset rules, GC deleting rooms and clearing timers.
5. **Bank loader**: every file in `data/crosswords/` validates against the schema.

**Playwright** (`npm run test:ui`) for everything that needs a real engine: `tests/` drives the built app against a real server, with a second browser context wherever the assertion is about two players. It covers the landing tabs, the roster and colour picking, removing a player, the ways out of a room, the keypad and switches, and grid geometry. `playwright.config.js` builds and starts the server itself, so the command is the whole setup.

**It runs in Chromium *and* Firefox, deliberately.** The grid is drawn with sub-pixel borders and two nested grids whose tracks must resolve identically in both; the one cell-alignment bug that reached a user was Firefox-only, because Chromium had rounded it away. A single-engine suite would have agreed with the bug.

The browser suite is also where the **rules that are distributed by hand** get checked — the focus ring and the control radius are repeated into every shadow root, so the only place to confirm they agree is where they land.

ESLint flat config + Prettier, both configured to the conventions in [code-style.md](code-style.md). CI on GitHub Actions, Node 22: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:ui && npm run build`.

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

**Outcome: `shared/` held; `<pt-board>` did not, and was extended rather than special-cased.** No logic changed in `protocol.js`, `schema.js`, `board-reducer.js`, or `puzzle-doc.js` — the batched `fill` op and the one-character cell value had been specified in Phase 1 and were waiting. `constants.js` gained list entries, which is the intended cost of a type, and `DIFFICULTY_MIN_SIDE` became per-type because sudoku's floor turned out to be sudoku's, not the platform's.

`<pt-board>` gained `valueGlyphs` and the two gutter hooks. That is a real gap closing rather than an abstraction failing: §7 had *claimed* since Phase 0 that subclasses supply "cell rendering ... and decorations (cage borders, clue gutters)", and no hook for either existed, because sudoku never asked for one. Both hooks are general and cost the other types nothing — a puzzle either draws a gutter or it does not, and a type that supplies no glyph map gets characters. **KenKen needed no `<pt-board>` change at all**, which is the cleaner half of the result.

**Phase 4 — crossword + bank.** Bank format, loader, validator, `.puz`/`.ipuz` importer, clue-list UI, direction toggle, entry highlighting.
*Done when*: a 15×15 puzzle is co-op solvable with synchronized clue-list state.

**Phase 5 — hardening.** Tests to meaningful coverage, CI green, Dockerfile, rate limits, load test with N simulated players in one room.

Docs are updated *within* each phase, not after — an ADR that no longer matches the code is worse than no ADR.

---

## 14. Risks and open questions

- **Crossword content licensing is the real blocker for Phase 4.** Which puzzles can legally ship? Hand-authored minis and public-domain sources are the safe start; needs a decision before Phase 4.
- ~~**KenKen uniqueness verification cost** grows sharply with grid size.~~ **Measured in Phase 3 and settled.** It does grow sharply — ~1ms at a 5×5 hard against ~170ms median and 870ms worst at a 7×7 hard — but 7×7 is comfortably inside a background pool refill, so the cap stays where §8 put it. The time budget and retry cap were built anyway, and bound the search for a *good* partition rather than the production of one.
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
