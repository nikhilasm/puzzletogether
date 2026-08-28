# PuzzleTogether: Design Spec

> **Status**: approved · **Branch**: `feature-puzzletogether` · **Last updated**: 2026-08-27
>
> Companions: [brand.md](brand.md) · [architecture.md](architecture.md) · [code-style.md](code-style.md) · [adr/](adr/) · [TODO.md](TODO.md)

## Context

PuzzleTogether is a platform where people create or join a room by short code and **collaboratively solve one shared puzzle grid in real time**, with per-player presence and a shared board. Launch types are sudoku, kenken, nonogram, and crossword, and a fifth type must be cheap to add.

It replaces a 2023-era prototype: ~500 lines of Express plus Socket.IO, jQuery template-swapping, no build step, no tests. The prototype's one game was a server-driven timed-reveal phrase guesser, which shares no abstractions with a co-op grid editor. What survives is the instincts: Express plus Socket.IO, in-memory rooms, short room codes, host controls.

Decisions taken up front:

- **Shared-grid co-op**, not a race.
- **Vite + vanilla JavaScript + Lit** web components. No TypeScript.
- **Hybrid puzzle supply**: runtime generators for sudoku/kenken/nonogram, a curated file bank for crossword.
- **In-memory rooms plus reconnect tokens.** No database, no accounts.
- **UI follows `pt_game_mock.png`**, with the brand system in [brand.md](brand.md).

---

## 1. Documentation

```
docs/
├─ design-spec.md          # this document
├─ TODO.md                 # living progress tracker across all phases
├─ brand.md                # tokens, type scale, usage rules
├─ architecture.md         # prose + Mermaid diagrams
├─ code-style.md           # formatting, comment/JSDoc rules, naming, enforcement
├─ (pt_game_mock.png)      # the UI reference, since removed; in git history at 9729cb5
└─ adr/                    # numbered, one decision each
```

Each ADR uses the short form: Context / Decision / Consequences / Alternatives rejected. Every one of them has a plausible-looking alternative that was deliberately declined, and the *why* is the point.

**A superseded ADR is kept and marked, never rewritten.** ADR-0008 lost to ADR-0010 in a day, and the record of why it looked right is the part worth having.

Diagrams live in [architecture.md](architecture.md) as Mermaid blocks, which GitHub renders natively: system context, room state machine, op lifecycle, join/reconnect, puzzle module boundary, and client structure.

[TODO.md](TODO.md) is the living progress tracker, updated as part of the work it tracks and never reconstructed afterward. It is the first place to look to answer "where are we?"

Docs are updated within each phase, not after. An ADR that no longer matches the code is worse than no ADR.

---

## 2. What the prototype left behind

The prototype's `html/`, `css/`, and `js/` were deleted in Phase 1, along with `jquery`, `bootstrap`, and `nodemon`. Two things were carried forward: the socket event vocabulary as a shape to imitate, and `shuffle()`, which became a seeded-RNG module so generated puzzles are reproducible.

Three of its bugs are requirements in disguise, and the design must not reproduce them:

- `disconnect` was an empty stub, so players leaked into rooms forever.
- Rooms were never garbage-collected: the sweep called `.length` on a plain object.
- Identity was the display-name string, and `isHost` was client-supplied and trusted.

The phrase guesser could return later as a non-grid type. It is not on the critical path.

---

## 3. Visual identity

The full system lives in **[brand.md](brand.md)**. The summary:

The brand rests on one metaphor, **a printed puzzle page, not a dashboard**, and three principles: the grid is the loudest thing on screen; colour belongs to people, not to chrome; soft chrome, sharp puzzle.

Cream paper rather than white, warm near-black ink, no cool gray. Fraunces (display) plus Karla (UI) plus DM Mono (room code), self-hosted. Borders instead of shadows. A ~3% graph-paper texture on the background.

---

## 4. The game screen

`pt_game_mock.png` is the layout of record. It is no longer tracked; it is in git history at `9729cb5`. Top to bottom:

- **Wordmark**: "Puzzle" in `--ink` plus "Together" in `--accent`, Fraunces with `WONK`.
- **The room panel**: room code, seat count, and roster inside one rule, no fill. The code sits top left in DM Mono `--accent`; the count `x/n` sits top right, unlabelled and centred against it rather than sharing its baseline. `<pt-app>` draws the count, since it is a fact about the room, which leaves the roster to be nothing but the roster. **Room codes are 4 lowercase characters.**
- **Players**: chips two per row, each name in that player's colour, the host's carrying a leading ★ and your own a trailing quiet `you`. Colour is carried by the name and nothing else. Disconnected players dim during the grace period before dropping off.
    - **Your own chip is a button**: it opens a palette of the ten colours, with the ones other players hold greyed and struck through. Colour is the only identity a player can change, so it is edited where it is shown, and the server enforces uniqueness.
    - **The host gets a remove control on everybody else's chip**, behind a confirm dialog. It is the one action done *to* another person. The removed player lands on the landing screen with the reason on screen; nothing stops them rejoining, because there are no accounts to ban.
- **Puzzle header**: `**Kenken**: Medium 4x4`. Header and timer are `--text-lg` and sit tight to the grid, reading as its caption. They are the same size as each other; weight separates them, so nothing competes with the grid.
- **Live solve timer**: mm:ss, counting up.
- **The grid**: heavy cage/region rules drawn as an overlay, small cage or clue labels in each cell's top-left.
    - **Entered values are large, bold, and `--ink`**, never tinted by author.
    - **Presence is a segmented stripe along the cell's bottom edge**, one equal segment per player focused there, sized from `--cell-size` and clamped to 3–6px. An edge cannot collide with a note or a value, and a fixed footprint that subdivides has no fourth-player problem. The overlay declares **both grid axes**, or every row past the first is an implicit track sized to its contents.
    - **Your own cursor is drawn in your own colour.** The board publishes the local player's `--player-N` as `--focus-color`, and the selection wash plus the lighter wash on the cells it implies (a sudoku's row and column, a crossword's entry) are mixed from it. It falls back to `--accent`. The line it does not cross is in [brand.md §3](brand.md#3-color): a wash says who is looking; a coloured value would say who wrote it.
    - **Pencil marks** are small `--pencil` digits, each in the fixed slot its digit always occupies, in a mark grid that also declares both axes.
    - **The grid is opaque**, and **every cell is the same box** whatever rules it carries: `border-box` with 1px hairlines throughout, region rules drawn over the top.
- **The notice line**: one italic `--graphite` line under the keys, for what the grid cannot answer by itself: pick a square first, a count of wrong cells after a check, an undo skipped because the cell has moved on. It is a `role="status"` live region that stays in the DOM empty, since a region must exist before the text arrives, and it takes **no height while empty**: an empty block has no line box, and its margins hang off `:not(:empty)`.
- **The puzzle-action row**: `Puzzle Select · Check · Reveal · Leave Room`, under a hairline, each with an icon **and its word**.
    - **Scope divides these from the panel's controls.** Erase and Undo stay in the panel because they act on the cell you are in; these act on the room's whole puzzle or on your seat in it, and two are host-only, so nobody reaches for Undo and lands on Reveal.
    - **Frequency decides the words.** These are pressed once or twice a puzzle, so an unlabelled icon would be a guess ([ADR-0012](adr/0012-a-label-under-every-icon.md)).
    - `Check` grades current entries; `Reveal` opens a confirm dialog naming the streak consequence; `Puzzle Select` is host-only and labelled as its destination, matching the congrats modal's button for the same action.
    - `Leave Room` is last and marked in `--danger`, the same size as the buttons beside it. With a host's full set the four come to about 618px against the row's 480px, so **Leave Room wraps to its own line**: same size, same rule, same reading order.
    - The row renders only the actions a given player has, and never disappears, because every player has Leave Room.
- **Footer**: a hairline, then the app's own controls. A **theme button** and an **About** button as icon buttons on one line, with **GitHub** and **Report an issue** as small links beneath. A button changes the app; a link leaves it.

Actions are buttons and settings are pressed buttons; see [brand.md §4](brand.md#controls-actions-settings-and-the-one-that-takes-something-away).

Screens: **Landing → Create / Join → Puzzle Select → Game.**

### Landing

Two **tabs**, `Create` and `Join`, over a single form. Create asks for a name; Join asks for a name and a room code. The tabs are text over a shared rule, not a pair of buttons: they name which half of the form you are looking at rather than offering two actions. The name input is rendered once, outside the branch, so changing tabs does not lose what you typed. Arriving on a room URL without a seat opens the Join tab with the code filled in.

### Puzzle Select

Where the host picks a puzzle while everyone waits, and where the room returns between puzzles. It also carries a `Leave Room` button.

**A generated type is described; a banked type is browsed** ([ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)). `<pt-puzzle-picker>` renders two shapes and **which one follows the provider, not the puzzle type**: a catalog entry carrying a `puzzles` array becomes a scrolling list of cards, one without keeps the size and difficulty rows.

**A choice can be offered and still carry a caveat.** A 20×20 nonogram is a good puzzle on a laptop and a cramped one on a phone, so the option wears a small warning triangle and explains itself in a line beneath the row once picked. It is not disabled: the host may well be on a laptop, and is often the one person in the room who cannot see the problem. The note is `--graphite` and never `--wrong`, because nothing has gone wrong, and the triangle rides in the option's accessible name. A type **defaults to its largest uncautioned size**.

**A browsed list can be filtered**, on size and difficulty, the only two facts every banked puzzle carries. Three rules keep the filters from becoming the interface again:

- **A row appears only when it has more than one value behind it.** On a bank of four 5×5 easy minis neither row is drawn and the list is the only thing on screen.
- **An option that would empty the list is disabled, not hidden.** That is also what guarantees the list is never empty, so Start can never point at a puzzle no longer on screen. Filtering the chosen card away moves the selection to the first one still visible, and the picker announces it.
- **The count appears only while a filter is on**: `Choose a puzzle · 2 of 12`.

**The list gets the whole column; the option rows keep a reading measure.** A card carries a title, an author, and a publication, so `<pt-puzzle-picker>` is given the full 40rem in Puzzle Select and in the congrats modal, and caps its own `fieldset`s at 28rem and centres them. 28 because that is where the four puzzle types stop wrapping.

### The input panel

**Every puzzle type is typed on a pad of ours, pinned to the foot of the viewport** ([ADR-0010](adr/0010-one-pinned-input-panel.md)). One `<pt-keypad>` serves all four types; only its contents differ. Top to bottom:

1. **The clue strip**: crossword only, and also its next-clue button.
2. **The button bar**: this type's one setting (Notes, a brush, or Rebus), then Erase and Undo, plus crossword's `Clues` and `Backspace`. Every control carries a one-word label under its icon, and the controls share the row (`flex: 1 1 0`) rather than each taking the width of its own word, which is what fits four of them on a 320px screen ([ADR-0012](adr/0012-a-label-under-every-icon.md)).
3. **The keys**: digits `1..n` sized to the puzzle's alphabet, or the three **QWERTY** rows, letters only. Every key is one width and the short rows are centred against the ten-key row above.

**Fixed rather than laid out with the page, which is the point of it.** A control in the flow scrolls away, and a 15×15 crossword or a 20×20 nonogram is taller than a phone. Pinning the keys means the grid above them can be scrolled, read, and worked while the ability to type never moves.

Because the panel is out of the flow it takes no room, so **the page reserves its measured height at its very foot**, in `<pt-app>` after the footer, not in `<pt-game>`.

**Scope is what puts a control here.** Everything that acts on a square is in the panel; everything that acts on the puzzle is down the page.

**The letters are QWERTY, not A–Z.** Alphabetical rows are easier to search, which sounds right until you notice nobody searches a keyboard they have used ten thousand times. The arrangement is the one thing a pad of ours can borrow from the platform keyboard it replaces.

**Undo is in the button bar**, beside Erase, because Ctrl+Z is not a thing a phone has and putting Undo with Erase keeps every way of changing a cell in one place. Ctrl+Z still works when the grid has keyboard focus.

**Every control in the panel suppresses focus on `pointerdown`.** Without it, pressing Notes or Rebus blurs the grid and the next physical keystroke goes nowhere: invisible on a touch screen, immediate on a desktop.

Input routes through the same op path as physical keyboard input and respects the current setting. The panel stays visible on desktop, where for the digit types it doubles as an affordance showing which digits remain available.

**Nonogram takes the setting slot with `Fill · Cross · Erase`**, a tri-toggle, because picking a brush changes what the grid does next rather than changing the grid. It replaces both the Notes toggle and the digits: a nonogram has no digits and no pencil marks, because the cross **is** the note.

**Erase leaves the row for nonogram and for crossword; Undo never does.** Erase clears the selected cell, the counterpart to pressing a digit into it, so a type with no digits has no use for it; nonogram erases by dragging with its erase brush, and crossword's counterpart is **Backspace**, which sits in the button bar. Backspace is a bar control rather than a key because it clears a square and steps back along the entry, which is what Erase and Undo do and not what pressing a letter does. The pad is letters and nothing else.

**Crossword's bar reads Clues · Rebus · Undo · Backspace.** Clues leads because it is the only control there that does not act on the square you are on. Backspace ends it, nearest the letters it corrects.

**A tap paints one square and a drag paints a run**, batched into a single `fill` op on release. What the whole stroke writes is decided from its first square: starting on a square that already holds what the brush paints means the stroke erases, so one gesture covers both painting a run and taking it back. Deciding per square would leave a checkerboard. The drag locks to the row or column it started along, because nonogram runs are straight. One drag is **one press of Undo**. The release is watched on the window, not the grid, so a stroke that ends past the edge still commits.

**The run is washed in the accent as the drag covers it, before anything is committed.** A stroke lands on release, and laying a run of a particular length against a clue is the entire reason to drag rather than tap. The wash is deeper than the selected cell's so it stays legible over marks already in the run. `isHighlighted` is the `<pt-board>` hook behind it, shared with crossword's entry highlighting.

**A filled square fills its whole cell**, so adjacent fills meet and a run reads as one bar the length of its clue. **Nonogram draws a heavier rule every five squares**, in the hairline's colour at three times its weight: it divides nothing, but matching a clue of 7 to a run is guesswork on an unmarked 20×20.

### Crossword

Crossword is the first type whose puzzle is not entirely visible in the grid. A sudoku shows everything it knows; a crossword keeps half of itself in a list. Every decision below follows from that.

**The current clue is the top strip of the input panel.** It is the single thing a solver needs at every moment, so it is the single thing always on screen, and it belongs with the keys that answer it. Rebus, Undo, Backspace, and Clues sit in the button bar below rather than crowding the one piece of text that has to be read.

**The clue is a button, and pressing it goes to the next clue in the direction being worked**: 7D to 8D, wrapping at the bottom of the Downs rather than falling into the Acrosses. There is one strip to give away and only one of the two actions can have it; moving on is what a solver does dozens of times a puzzle. Turning around keeps the gesture it always had, **tapping the square the cursor is already on**, plus <kbd>Space</kbd> and the perpendicular arrow.

The direction is written **`7D`, not `7 Down`**: four characters of every entry is a real cost, and the abbreviation says nothing a solver cannot see in the grid. The full words stay in the accessible name.

**<kbd>Tab</kbd> is distinct.** It walks the printed clue list and does fall out of the Acrosses into the Downs. Both behaviours are wanted; they are different questions.

**The full Across and Down lists open over the grid, behind one `Clues` button.** Two scrolling lists and a 15×15 do not fit a phone together, and on the desktop column they would take the grid's width to show a list read once per entry. So the lists are a place you go: they open as a dialog, the current entry is marked, and picking any clue jumps the cursor to its first square and closes. Scanning for a way in becomes a deliberate act, which is the cost of keeping the grid the loudest thing on screen; the clue strip is what makes it affordable, since the clue you are on never requires the dialog.

Because the keys are ours, crossword's keystrokes are read the same way every other type's are: on the grid, from `keydown`.

**A square holds one letter unless the player says otherwise.** Typing replaces the square's contents and moves on. With **Rebus** on, typing appends and the square holds a whole word, the device a themed crossword is often built around ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). Holding <kbd>Shift</kbd> does the same for one keystroke on a physical keyboard; **on a touch screen the toggle is the only path**, since our pad has no Shift and a phone's own produces an uppercase letter and no separate signal. That is why it holds its state visibly.

The value grows to fit the square down to a floor: two to five characters are set to fit the width, and past that the size holds and the text clips, with the whole string in the square's `aria-label`.

**Navigation is what a crossword solver already expects, and it is worth being literal:**

- Typing advances to the next square in the current entry, **stepping over squares that already hold a letter**, and **stops at the end of the entry**. Jumping the crossings is what makes a half-filled entry typable: with `FR__T` on screen, `U`-`I` has to produce `FRUIT`, and in a room solving together the letter being overwritten is somebody else's.
- <kbd>Backspace</kbd> **takes the letter out and steps back**, so a held key walks a wrong answer out a square at a time. It never leaves the entry: at the first square it empties it and stops. On a rebus square mid-assembly it peels one character and **keeps** the cursor. <kbd>Delete</kbd> is the same rule minus the step. The panel's Backspace button asks the board for the same act rather than reimplementing it.
- Clicking a square selects it; clicking the **selected** square flips direction.
- <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> move to the next and previous entry in the printed clue list.
- Arrow keys along the current direction move the cursor. Arrow keys **across** it move the cursor *and* flip the direction, which is the rule people rely on without being able to state.
- Blocked squares are never selected, by click or by arrow.

**The cursor is a solid statement of position and the entry around it is barely a tint**, at 62% and 13% of the focus colour. The two washes answer different questions, *where am I* and *which word am I in*, and the second only has to be distinguishable from no wash at all.

**Black squares are `--ink`** and carry no number, no cursor, and no presence stripe. **Circled squares** (`GEXT` in the source files, where a themed puzzle usually hides its bonus answer) draw as a thin `--graphite` ring inset in the square, so they read as an annotation rather than a value.

**The clue list is synchronized with your own cursor, not with the room's.** It follows your position and direction and scrolls the current clue into view; where everyone else is working stays on the grid as presence stripes. Adding direction to `game:focus` would let the list say precisely which entry each player is on, and it is deliberately not built: a protocol change bought for a nicety.

**15×15 needs no caveat on small screens.** At 320px it comes out at 19px squares with no horizontal overflow, which is what every crossword app on a phone ships, and nothing like the 20×20 nonogram's ten-pixel squares with a third of the width lost to clue gutters. `SIZE_CAUTION` has no crossword entry. What the small screen costs instead is vertical: the panel takes about 16rem and the grid gets the rest, which is a number we chose and can revisit.

### Completion modal

On server-verified completion, **every player** gets a dismissable congrats modal showing the **solve time**, the **room's solve streak**, and the assist count. The host additionally sees controls to start a new puzzle, defaulting to the one just finished. Its three buttons are one row, all with icons. Dismissing leaves the completed grid on screen; non-hosts wait until the host starts the next puzzle or returns the room to select.

**The grid celebrates first.** A wave of colour crosses the finished grid and the modal waits for it; see [brand.md §5](brand.md#5-motion). A reveal never celebrates.

**Streak semantics**: increments per solved puzzle. Resets to 0 on **Reveal** or on abandoning an unfinished puzzle via Puzzle Select. **Check is free.** The streak lives on the room and dies with it.

---

## 5. Repo layout

```
puzzletogether/
├─ package.json  vite.config.js  jsconfig.json    # checkJs: true
├─ eslint.config.js  .prettierrc  playwright.config.js
├─ tests/                      # Playwright: the app in a real browser, two clients (§12)
├─ scripts/import-crossword.js # .puz/.ipuz → a bank file; run by hand, never at boot
├─ Dockerfile  .env.example  .github/workflows/ci.yml
├─ docs/                       # see §1
├─ data/crosswords/
│  ├─ index.json               # manifest: id, file, size, difficulty, title, author, source, license
│  └─ mini-0001.json …         # the finished doc + its solution
├─ data/crosswords-local/      # gitignored overlay: prototype imports, never committed (ADR-0004)
├─ shared/                     # imported by BOTH server and client
│  ├─ protocol.js              # event constants, PROTOCOL_VERSION, JSDoc typedefs
│  ├─ schema.js                # runtime payload validator
│  ├─ constants.js             # player palette, limits, timings
│  ├─ puzzle-doc.js            # idx↔(r,c), cell helpers; nothing type-specific
│  └─ board-reducer.js         # applyOp(), shared by server and client
├─ server/
│  ├─ index.js  config.js
│  ├─ rooms/{store,lifecycle,codes,progress}.js
│  ├─ net/{handlers,auth,ratelimit}.js
│  └─ puzzles/
│     ├─ provider.js           # getPuzzle({type, difficulty, size, puzzleId}) seam
│     ├─ pool.js               # pre-warmed pools + worker_threads
│     ├─ value-grid.js         # isComplete/checkCells for one-value-per-cell types
│     ├─ bank.js               # file-backed provider (crossword) + catalog()
│     └─ sudoku/  kenken/  nonogram/  crossword/
│                              # crossword/ holds numbering.js: derived once, used to build and to check
└─ client/
   ├─ index.html  main.js
   ├─ styles/{tokens.css,base.css,controls.js}   # the brand system, as custom properties
   ├─ theme.js                       # light/dark, persisted
   ├─ store/{room-store.js,store-controller.js,ops.js,undo-stack.js}
   ├─ views/{pt-app,pt-landing,pt-puzzle-select,pt-game,pt-congrats-modal,pt-confirm,pt-about}.js
   ├─ ui/{pt-player-chips,pt-timer,pt-keypad,pt-mode-toggle,pt-brush-bar,pt-puzzle-picker,icons}.js
   │  # pt-keypad is the pinned input panel for every type: clue slot, action bar, keys (ADR-0010)
   │  └─ {pt-clue-bar,pt-clue-list}.js   # crossword's clue strip and its clue dialog
   └─ boards/{registry,pt-board,pt-cell,pt-presence-layer,pt-celebration-layer}.js
      └─ {pt-sudoku-board,pt-kenken-board,pt-nonogram-board,pt-crossword-board,crossword-entries}.js
```

**Dev**: Vite on 5173 with `server.proxy` sending `/socket.io` and `/api` to Express on **3001**. `npm run dev` runs both via `concurrently`. Both sides read `PORT` from the same place, so the proxy and the Express process cannot disagree.
**Prod**: `vite build` → `client/dist`, Express serves it statically. One Node process.

---

## 6. The shared-state model (the core problem)

**Server-authoritative, per-cell last-writer-wins, with a monotonic room-level `seq`.** → [ADR-0001](adr/0001-shared-state-lww-per-cell.md)

Not a CRDT and not OT. Grid cells are independent registers; there is no insertion-ordering problem the way there is in text. When two people type into the same cell, "the later one wins" is both the simplest rule and the one users expect from shared spreadsheets.

**Ops** (client → server; the server assigns `seq` and rebroadcasts):

```js
{ opId: 'c4f1-7', t: 'set',   cell: 42, value: '5' }
{ opId: 'c4f1-8', t: 'marks', cell: 42, marks: [1,3,7] }   // pencil marks, set semantics
{ opId: 'c4f1-9', t: 'clear', cell: 42 }
{ opId: 'c4f1-a', t: 'fill',  cells: [12,13,14], value: 'x' }  // nonogram drag, batched
```

Server echo adds `{ seq, by: playerId, at }`. Board state is `{ seq, cells: { [idx]: { value, marks, by, seq } } }`. `by` is the last writer, retained because LWW needs it; it is not used to tint values.

**A cell holds a value or marks, never both.** A `set` clears the cell's marks, since they were notes toward it, and a `marks` op clears the value. This is how a cell already rendered, and it is what makes a cell's entire state expressible in a single op, which is what lets undo restore any earlier state with one write.

**Optimistic application.** The client applies its own op immediately, holds it in `pendingOps`, and renders `serverState + pendingOps`. When the echo arrives with a matching `opId`, the op leaves the pending list. A remote op landing on a cell with a pending local op is resolved by the render function; no rollback machinery, because re-deriving is cheap.

**Gap recovery over op buffering.** Each client tracks the last `seq` it saw. A gap triggers `sync:request` and the server replies with a full snapshot. Snapshots are a few KB, so this is simpler and more robust than replaying buffered history.

**No hard locks.** Focus is broadcast as presence and rendered as the cells' presence stripes. Hard-locking cells in a five-person puzzle is more frustrating than the rare collision it prevents.

**Undo is per-player and forward-only.** Each client keeps a stack of its own ops with pre-images. Undo emits a new `set` restoring the prior value; it never rewinds global history. If someone else has since changed that cell, the undo is skipped with a notice.

**The solution never leaves the server.** `room.solution` sits beside the doc and is never serialized. Check and Reveal are RPCs, both gated by room settings, both incrementing a per-room assist counter, and a full Reveal breaks the streak. This is also what makes "did we actually solve it" server-verified rather than client-claimed.

**Timer.** The server stamps `startedAt` and includes it plus its own clock in the snapshot; clients render mm:ss locally against a computed offset, so no timer ticks cross the wire. On solve the server computes the authoritative `elapsedMs` and broadcasts it with `game:solved`.

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
| crossword | `{ entries: [{ num, dir: 'A'\|'D', cells: [idx], clue, len }], alphabet: 'A…Z', circled: [idx] }` | letter, rebus word, or null |

**Nonogram's two values are single characters named in its own `meta`**, rather than agreed as a shared constant, so the board reads what *this puzzle* uses. Same reason sudoku's alphabet travels in the document.

**A cell value is 1–8 characters on the wire, and each type narrows that itself.** `schema.js` exists to bound what crosses the wire, not to describe puzzles; what may go in a cell is what `validateOp` is for ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). Sudoku, kenken, and nonogram accept exactly one character each, and now say so themselves.

**So a new type must bound its own values, and nothing will remind it.** This is the one piece of discipline that lives in review rather than in the schema. It is also where the widening turned up a bug the old rule had hidden: sudoku and kenken tested membership with `doc.meta.alphabet.includes(value)`, which on a string matches substrings, so `'12'` would have passed the moment a two-character value could reach it. A check that has never been wrong may only be a check that has never been reached.

**Nonogram has no pencil marks**: the cross is the note, so it lives in the cell's value and `marks[]` stays empty. It is also the one type whose `isComplete` cannot be the shared value-grid comparison, since a grid is solved by its filled squares alone.

**KenKen labels its cages through `DocCell.label`**, which already draws in a cell's top-left corner. The server writes `12+` or `3÷` onto each cage's first cell and the board never renders a label itself.

**A clue and a note both want that corner, so the clue is given a row of the mark grid.** A mark's position is which digit it is, and marks paint after the label, so a full set of notes hid the clue it was there to solve. The board declares `reservesLabelRow`, the cell adds a row and starts the notes one row down, and the clue is sized by that track. The cost is one row of note height, real at 7×7 on a phone and invisible at 4×4.

**A label is drawn and it is also said, and those are two different jobs.** `<pt-board>` puts `DocCell.label` into the cell's `aria-label`. Saying it is not simply reading it: at a screen reader's usual verbosity punctuation is skipped, so `12+` and `12` are announced identically. The `spokenLabel(label, idx)` hook lets the subclass supply the phrase (kenken says "cage 12 plus"), because only the subclass knows what its label means. **A blocked square says "blocked" and stops**, since "empty" would invite an edit that is not possible.

**Server module interface**: each `server/puzzles/<type>/index.js` default-exports:

```js
{
  type,
  create({ difficulty, size, rng }) → { doc, solution },   // generated types only
  validateOp(doc, op) → boolean,
  isComplete(doc, board, solution) → boolean,
  checkCells(doc, board, solution, idxs) → { [idx]: 'correct'|'wrong'|'empty' },
}
```

**This is two interfaces wearing one name.** `create` produces a puzzle; the other three rule on one. Three types need both because they make their own puzzles; crossword, whose clues are written by a person, supplies the rules only, and `provider.js` is what knows which producer a type has. A fifth generated type writes all four; a second banked type writes three.

The rules themselves are almost entirely borrowed: a crossword cell holds one value compared against one solution value, which is what `value-grid.js` already says for sudoku and kenken. The only method genuinely crossword's own is `validateOp`.

**Provider seam**: `server/puzzles/provider.js` exposes `getPuzzle({ type, difficulty, size, puzzleId })`, backed by `GeneratorProvider` (sudoku/kenken/nonogram) and `BankProvider` (crossword). Identical interface, so a future DB provider drops in with no call-site change. → [ADR-0004](adr/0004-hybrid-puzzle-supply.md)

**A generator can make anything it offers; a bank holds what it holds, so the provider also publishes a catalog.** `provider.catalog()` returns what is genuinely available per type, computed once at boot, and the server sends it with the join ack so the picker offers what exists rather than what a constant hopes exists. Three things follow:

- **A type with nothing behind it is not offered at all.** A build whose crossword bank is empty shows three puzzle types, not four with one that fails when picked, which is the normal state of any build without a licensed bank.
- **Crossword sizes are not square sides.** Real crosswords are 15×15 and 5×5 and also 20×21, so the catalog carries `{ rows, cols }` pairs and Puzzle Select labels them as it finds them.
- **A banked type lists its puzzles by name.** `bankCatalog()` carries a `puzzles` array (`id`, `title`, `author`, `source`, `size`, `difficulty`) and `game:start` takes an optional `puzzleId` ([ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)).

**The browser suite pins the bank it reads, through `PT_BANK_DIRS`.** The second bank directory is a scratch space holding whatever `.puz` files a developer last imported, so a test asserting what the bank *holds* would otherwise pass or fail on which machine ran it. `server/config.js` takes the list from the environment when given one, and `playwright.config.js` sets it to `data/crosswords` alone.

**A room does not serve the same banked puzzle twice running.** A generator never repeats by construction; a bank of thirty will, and "start another" landing on the puzzle just solved would read as the button being broken. The room remembers the ids it has been served. **A named `puzzleId` overrides that**: having pressed a title off a list, the host means that puzzle.

**Client**: `<pt-board>` owns grid geometry, cell DOM, selection, the presence layer, and op emission. Subclasses supply cell rendering, the keyboard/keypad map, input filtering, and decorations. A fifth type is one server module plus one Lit subclass, touching nothing shared.

| hook | answers | used by |
|---|---|---|
| `isHeavyRight` / `isHeavyBottom` | where the heavy rules go | sudoku regions, kenken cages, nonogram's counting bands |
| `valueForKey` | what a keystroke writes here | all |
| `markColumns` / `markRows` | how pencil marks lay out | sudoku, kenken |
| `reservesLabelRow` | whether the cell's label takes a mark row to itself | kenken cage clues |
| `spokenLabel(label, idx)` | how that label is said, when it is not how it is drawn | kenken cage clues; crossword numbers |
| `valueGlyphs` | whether a value is drawn as a character or as a mark | nonogram |
| `renderTopGutter` / `renderSideGutter` | what is drawn alongside the grid, aligned to its tracks | nonogram |
| `isHighlighted` | which cells the gesture in progress covers, as distinct from the selection | sudoku/kenken row and column; nonogram drags; crossword entries |
| `nextSelection(from, dRow, dCol)` | where an arrow key lands, when it is not simply the next square | crossword: skips blocks, flips direction across the entry |
| `advanceAfterInput(idx)` | where the cursor goes once a value is written, or nowhere | crossword auto-advance |
| `isCircled` | whether the square is annotated rather than special | crossword themed squares |
| `celebrates(idx)` | whether a square takes part in the solve wave | crossword skips blocks; nonogram also skips fills |

**Crossword pulls on navigation the way nonogram pulled on rendering.** `nextSelection` and `advanceAfterInput` exist because a crossword is the first type where moving the cursor is a puzzle-specific act: everywhere else an arrow key means the adjacent square and typing means stay put, and both were hard-coded in `<pt-board>` because no type had disagreed. `spokenLabel` gains the cell index because a crossword number describes the entries that *start* at a square.

One change to `<pt-board>` is not a hook and not crossword's: **a blocked square is never selected**, by click or by arrow. No existing type has block cells, so it costs them nothing; it is the base element finally being asked a question the doc schema has allowed since Phase 0.

**Crossword entry lookup lives in the client, not in `shared/`.** `shared/` is what both sides need, and the server does not need this: a crossword's `validateOp`, `isComplete`, and `checkCells` are the value-grid code sudoku and kenken already share, and none of them asks what an entry is. Entries serve highlighting, auto-advance, and clue-list sync, which are the board's concerns, so lookup lives in `client/boards/crossword-entries.js` beside its consumer. `entries[].cells` is stored explicitly in the document, so lookup is indexing rather than derivation; there is no algorithm two sides could implement differently.

**The board element for a type, and the kind of input it takes, are declared in `client/boards/registry.js`.** The game screen branches on the input style (`digits`, `brushes`, `letters`), never on the type name. Sudoku and kenken share `digits` despite having nothing else in common, which is the point.

---

## 8. Generation

**Sudoku.** Randomized-backtracking solved grid, then dig holes symmetrically, checking after each dig that exactly one solution remains (counting solver aborting at 2). Difficulty rated by which techniques a logical solver needs: singles → easy, pairs/pointing → medium, X-wing and beyond → hard. Single-digit to low-tens of milliseconds.

**KenKen.** Random Latin square → flood-fill partition into cages with a size distribution → assign operations (`-` and `/` only for 2-cell cages where they divide evenly) → verify uniqueness with a cage-constraint solver. Uniqueness verification is the expensive step. Sizes 4–7 are offered; measured cost is ~1ms at 5×5 and ~170ms median / 870ms worst at a 7×7 hard, which the pre-warm pool absorbs.

A partition that is not unique is **tightened rather than redrawn**: the largest cage is split in two and the solver asked again. That is the opposite direction from sudoku, and it is what makes generation total. Splitting far enough leaves every cell in a cage of its own, where each clue names its digit, so the loop cannot fail to terminate; at worst it terminates on an easier puzzle than was asked for. The time budget and retry cap bound the search for a puzzle that needed *no* splitting.

**KenKen's difficulty is a generation parameter, not a measurement**, the one place the platform knowingly departs from "the label is the measured rating". Rating a KenKen honestly would need a technique-ranked cage solver, which is the same expensive search that already dominates generation. Single-cell cages are free digits, so how many a puzzle may keep is capped explicitly (8% of cells at easy, 2% at medium, none at hard); cage growth strands singletons whatever the size distribution asks for, and unchecked that put nine free digits in a 7×7 easy.

**Nonogram.** Random bitmap at a target density → clue it → run a line-solver, **rejecting any puzzle the line-solver cannot uniquely resolve**, since ambiguous nonograms are the classic failure mode. Random bitmaps rather than recognizable pictures for now; `drawBitmap` is the seam a sprite library drops into, and a hand-drawn sprite would face the same rejection. Cells are drawn independently rather than in blobs: clustered pixels make longer runs, and long runs are what the overlap deduction eats first, so blob-drawn grids came out uniformly easy.

**Nonogram's difficulty is measured**, by the same solver that proves it fair: sweeping rows and columns until nothing changes is what a person does, so how many sweeps it took is a property of the puzzle. The last sweep is not counted, since it deduces nothing. Thresholds are a fraction of the grid's side (0.3 medium, 0.45 hard), normalized because information travels one row and one column per sweep.

**Latency strategy: pre-warmed pools in a worker thread.** `server/puzzles/pool.js` keeps N ready puzzles per (type, difficulty, size), refilled in the background via `node:worker_threads`. `getPuzzle` pops from the pool, falling back to synchronous generation only if dry.

**Crossword bank.** `data/crosswords/index.json` manifest plus one JSON per puzzle, validated at boot. Seeded with hand-authored minis, plus `scripts/import-crossword.js` to convert `.puz`/`.ipuz`. Auto-generated clues are poor, which is why this type is banked rather than generated.

**A bank file holds the finished document and its solution; the loader validates, it does not compile.** Entry numbering is derived from the grid by one function, `numberGrid()`, at import time, so what is tracked is explicit and reviewable. The same function runs at boot as a **check**: the loader re-derives the numbering and refuses a file whose stored `entries` disagree with its own grid. A stored entry list that nothing verifies is just a second place to be wrong.

**Crossword's difficulty is declared**, which is a third answer to a question the platform answers three ways. There is nothing to measure: difficulty in a crossword is how obscure the clues are, which is a property of the writing. Recorded here so the inconsistency is a decision rather than a discovery.

**The importer refuses more than it converts, and that is the point.** From `.puz` it reads the header, the solution and player grids, the clue list, and the extension sections. It **carries** `GRBS`/`RTBL` rebus squares and `GEXT` circled squares, which is where a themed puzzle keeps its theme. It **ignores** `LTIM` and `RUSR`, a saved timer and a stranger's partial solve. It **refuses**, by name and with the reason: a scrambled puzzle, a grid outside the schema's 25×25 bound, a rebus longer than `MAX_CELL_VALUE_LENGTH`, and any file whose derived numbering does not match its own clue count.

**It also refuses to write a bank file without an explicit licence.** `--license` is a required argument, not a field guessed from the source's copyright string, and the string is carried into the manifest as `source` alongside it. This is [ADR-0004](adr/0004-hybrid-puzzle-supply.md)'s split made mechanical: the pipeline can be developed against any file, and nothing reaches `data/crosswords/` without somebody having answered the question of what may be served.

---

## 9. Rooms, identity, lifecycle

**Room codes**: 4 lowercase characters from an unambiguous alphabet (no `l`/`o`), collision-checked against the room map. Four chars from ~24 letters is ~330k combinations: plenty for concurrent rooms, small enough that collision checking is mandatory.

**Reconnect tokens**: on first join the server issues an opaque 32-byte hex `playerToken`, stored in `localStorage` and sent in the Socket.IO handshake `auth`. The server maps `token → playerId` per room; reconnecting restores name, colour, and host status and re-attaches the socket. Chips dim for a ~2 minute grace period before a player is dropped. → [ADR-0005](adr/0005-reconnect-tokens-for-identity.md)

```js
room = {
  code, state: 'select' | 'playing' | 'solved',
  hostId, createdAt, lastActivityAt,
  settings: { type, difficulty, size, checkingAllowed, revealAllowed },
  players: Map(playerId → { name, color, socketId|null, connected, joinedAt }),
  streak: 0,
  doc, solution, board: { seq, cells }, startedAt, assists: 0,
  served: Set,          // banked puzzle ids this room has had, so a finite bank does not repeat
  timers: Set,
}
```

**`served` exists only because a bank is finite.** For the three generated types it stays empty. It is per room and dies with it, like the streak.

**Colours** come from the brand palette in `shared/constants.js`, assigned by lowest free index and released on leave.

**Host**: first joiner. On host disconnect past the grace window, promote the longest-connected player. Every host-only action (`game:start`, `room:backToSelect`, `room:kick`, `room:settings`, `game:reveal`) is authorized server-side against `playerId === room.hostId`. The client's `isHost` controls only whether the ★ and host buttons render.

**GC**: a 60-second sweep deletes rooms with zero connected players for >10 minutes, or total age >12 hours, clearing every timer in `room.timers` first.

---

## 10. Socket protocol

Client → server, all with acks of the form `cb({ ok: true, data }) | cb({ ok: false, error: { code, message } })`:

`room:create`, `room:join`, `room:leave`, `room:kick`, `room:settings`, `room:backToSelect`, `player:color`, `game:start`, `game:op`, `game:focus`, `game:check`, `game:reveal`, `sync:request`

Server → client:

`room:state`, `room:players`, `room:host`, `game:started`, `game:snapshot`, `game:op`, `game:focus`, `game:checkResult`, `game:solved`, `error`

`room:settings` is still unimplemented; nothing so far needs it.

**The puzzle catalog rides the `room:create` / `room:join` ack**, not `room:state`. It is fixed for the life of the process, so it belongs with `PROTOCOL_VERSION` in the one payload a client receives exactly once rather than being re-sent with every state change that cannot have altered it. It is the whole protocol cost of the bank.

**`game:start` carries an optional `puzzleId`**, naming one puzzle out of a bank's catalog. It is validated as shape only, 64 characters of `[\w.-]`, because whether the id exists is the provider's question, and a client holding a catalog older than the bank is a restart rather than an error: an unknown id falls back to the size and difficulty beside it. The three generated types never send one.

**Crossword adds nothing else to the protocol.** No new event, no new op type, no new field: a letter is a `set` and a rebus is a longer `set`. The one deliberate omission is direction on `game:focus`.

**`room:kick` is host-only and takes a `playerId`.** The removed player is told before their seat is dropped, via a `KICKED` error, which is the one error a client receives without having asked for anything. Their reconnect token dies with the seat; the room code still works, because a kick is a nudge rather than a ban.

**`player:color` carries a palette index and nothing else.** A seat only speaks for itself, so there is no target player in the payload and the handler needs no authority check beyond "you hold a seat". The server refuses an index another player holds. The answer comes back as a `room:players` broadcast rather than an ack payload, since the client cannot know what the rest of the room holds.

**`game:check` grades the whole grid and its result is broadcast to the room.** Assists are counted per room, so a check is something the room did rather than something one player did quietly, and a check with no cell list is one a client cannot use to interrogate the solution a cell at a time. `game:reveal` is grid-scope and host-only; there is no cell-scope reveal.

```js
// game:solved
{ elapsedMs: 103_000, streak: 4, assists: 1, revealed: false,
  board: { seq, cells } }   // final board, so late joiners see the solved grid
```

**Keeping payloads honest without TypeScript**: `shared/protocol.js` holds event constants, `PROTOCOL_VERSION`, and JSDoc `@typedef`s for every payload. `shared/schema.js` is a declarative runtime validator applied to every inbound payload at the server boundary. `jsconfig.json` with `checkJs: true` turns the JSDoc into editor-level type checking. → [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md)

The handshake carries `PROTOCOL_VERSION`; a major mismatch returns a "please refresh" error rather than mysterious breakage after a deploy.

---

## 11. Client architecture

- `<pt-app>` root with a hash router: `#/` → landing, `#/room/kqjy` → puzzle select or game, driven by `room.state`.
- **The route owns the seat.** Navigating away from a room releases it, so the back button, the wordmark, and `Leave Room` are one path and cannot drift apart. A reload is deliberately not this path: it fires no `hashchange`, so a refresh mid-solve restores from the reconnect token. The room header and roster render only on the room route.
- **One `RoomStore`** owns the socket, room state, board state, pending ops, and timer offset. Components never hold sockets. `StoreController`, a Lit `ReactiveController`, subscribes any element to the slices it needs.
- **Rendering perf.** Cells render once as `<pt-cell>` elements keyed by index via `repeat()`; per-cell updates mutate that element's reactive properties. Presence stripes live in a separate `<pt-presence-layer>` overlay, and the solve wave in `<pt-celebration-layer>`, so neither touches cell DOM.
- **Input** flows through one path regardless of source: physical keyboard, the panel's keys, or touch. A tapped key and a pressed key reach the store through the same method, so they cannot mean different things; where a key needs a rule only the board knows, the screen asks the board rather than reimplementing it.
- **Theme**: `data-theme` on `<html>` plus the brand custom properties. The footer's theme button persists to `localStorage`, the initial value respects `prefers-color-scheme`, and an inline bootstrap in `index.html` applies it before first paint.
- **Shared styling** lives in `client/styles/controls.js` as `css` fragments each component composes into its own `static styles`. Shadow roots inherit properties, not rules, so anything that must be consistent app-wide has to be distributed rather than declared once globally.
- **Accessibility**: `role="grid"`/`gridcell`, aria-labels carrying clue and cage text, a live region for presence changes and completion, managed focus, `prefers-reduced-motion` honoured, and presence conveyed by name as well as colour. Settings are `aria-pressed` buttons so their state is announced as a state; the landing tabs follow the `tablist` pattern including arrow-key movement; every colour swatch is labelled with its colour's name; icons are decorative and `aria-hidden`.

---

## 12. Testing, tooling, CI

Two suites, split by what they can see.

**Vitest** (`npm test`) for logic, no DOM. Highest-value targets:

1. **Generator invariants** (property-style): 200 puzzles per type, asserting exactly one solution, stable difficulty rating, and for nonogram that the line-solver resolves it.
2. **Board reducer**: op ordering under LWW, and the key equivalence, sequential op application equals the snapshot.
3. **Protocol schema validation**: malformed payloads rejected, never crashing a handler.
4. **Room lifecycle**: reconnect-token restore, host election on disconnect, colour uniqueness, streak rules, GC deleting rooms and clearing timers.
5. **Bank loader**: every file in `data/crosswords/` validates and re-derives its own numbering. The one place the suite tests content rather than code, and worth it: a hand-edited grid whose entries no longer describe it is not a crash but an unsolvable puzzle.
6. **The importer's refusals**, on `.puz` files assembled byte by byte in the test. The real samples are `.gitignore`d, so a test reading them would pass on one machine and fail on every other.
7. **`css-templates.test.js`**: no backtick inside a comment in a `css` template.

**Playwright** (`npm run test:ui`) for everything that needs a real engine. `tests/` drives the built app against a real server, with a second browser context wherever the assertion is about two players. `playwright.config.js` builds and starts the server itself and **never reuses an existing server**: the `webServer` command builds, so reusing one means testing whatever bundle was current when that server started.

**It runs in Chromium and Firefox, deliberately.** The grid is drawn with sub-pixel borders and two nested grids whose tracks must resolve identically in both; the one cell-alignment bug that reached a user was Firefox-only, because Chromium had rounded it away. A single-engine suite would have agreed with the bug.

The browser suite is also where the **rules distributed by hand** get checked: the focus ring and the control radius are repeated into every shadow root, so the only place to confirm they agree is where they land.

Two things learned from testing transients: a claim that two things never overlap must be read in **one** `evaluate`, since two locator calls are two different moments; and Playwright's default polling backs off to a second between samples, which is longer than the solve wave, so such tests pin `intervals: [50]`. `test.use({ reducedMotion: 'reduce' })` does not reach `matchMedia` in this Playwright version; `page.emulateMedia()` sets both.

ESLint flat config plus Prettier, configured to [code-style.md](code-style.md). CI on GitHub Actions, Node 22: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:ui && npm run build`.

Deployment is a single Node process with a Dockerfile and `PORT`/`NODE_ENV`.

---

## 13. Phases

Phase 1 is a vertical slice deliberately: the co-op sync model is the risky part and should be proven with one puzzle type before the others exist. Progress is tracked in [TODO.md](TODO.md).

| Phase | Scope | Done when |
|---|---|---|
| 0 | Documentation, per §1 | `docs/` merged and reviewed |
| 1 | Vertical slice: Vite + Lit + Express + Socket.IO, brand tokens, `shared/` protocol/schema/reducer, rooms with codes, tokens, host authorization, GC, sudoku generator plus pool, the mock's layout, `<pt-sudoku-board>`, optimistic ops with echo and gap recovery, server-verified solve | Two browsers in one room edit the same sudoku live with visible presence, one refreshes mid-solve and returns with name/colour/host intact, and completing the grid triggers solve detection |
| 2 | The full game screen: keypad, Notes, pencil marks, Check and Reveal plus assists, per-player undo, congrats modal, host new-puzzle controls, Puzzle Select, dark theme, mobile input, a11y pass | A full session is playable on a phone without touching the console, and the streak increments and resets per §4 |
| 3 | Nonogram + kenken, the real test of §7 | Both are playable and **adding them required no changes to `shared/` or `<pt-board>`** |
| 4 | Crossword + bank: bank format, loader, validator, importer, provider catalog, clue bar and dialog, letter input, entry highlighting, rebus | A 15×15 is co-op solvable with synchronized clue-list state |
| 4a/4b | Revision passes after two playtests, 2026-08-05 and 2026-08-06. See §16 | |
| 5 | Hardening: tests to meaningful coverage, CI green, Dockerfile, rate limits, load test | CI is green and the production build survives a load test |

**Phase 3's outcome: `shared/` held; `<pt-board>` did not, and was extended rather than special-cased.** No logic changed in `protocol.js`, `schema.js`, `board-reducer.js`, or `puzzle-doc.js`; the batched `fill` op and the one-character cell value had been specified in Phase 1 and were waiting. `constants.js` gained list entries, which is the intended cost of a type, and `DIFFICULTY_MIN_SIDE` became per-type because sudoku's floor turned out to be sudoku's, not the platform's. `<pt-board>` gained `valueGlyphs` and the two gutter hooks, which is a gap closing rather than an abstraction failing: §7 had claimed since Phase 0 that subclasses supply cell rendering and clue gutters, and no hook for either existed because sudoku never asked. **KenKen needed no `<pt-board>` change at all.**

**Phase 4 knowingly touched `shared/`**: the cell-value bound moved from one character to eight so a rebus square can exist ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). That is a bound rather than a behaviour; no op, reducer, or event changed shape.

---

## 14. Risks and open questions

- **Crossword content licensing is the blocker for shipping, not for building.** Which puzzles can legally ship is open; hand-authored minis and public-domain sources remain the safe start. The importer and the bank are developed against freely-distributed `.puz` files, which stay out of the repo: free to download is not free to redistribute, and a commit is a redistribution. → [ADR-0004](adr/0004-hybrid-puzzle-supply.md)
- **A rebus is capped at 8 characters** and the discipline that keeps other types at one is review's rather than the schema's. A fifth type that forgets to bound its own values gets a bug, not an error. → [ADR-0007](adr/0007-rebus-widens-the-cell-value.md)
- **Turning the cursor around has no button on a touch screen.** The clue strip's one press went to next clue, so flipping Across/Down is a gesture, and gestures are not discoverable by looking. It is the convention every crossword app teaches, which is the whole of the argument for it.
- **The input panel costs about 16rem of a phone screen**, against roughly 3rem for the clue bar it replaced. That is the price of a layout that never moves, and it is a number we chose rather than one the platform imposed. A collapse handle is the obvious lever and was deliberately not built: it is a state a player can be stuck in and a control to explain. → [ADR-0010](adr/0010-one-pinned-input-panel.md)
- **Nobody gets word suggestions, swipe typing, or dictation in a crossword.** This is the sharpest edge of ADR-0010 and the one it cannot mitigate.
- **The catalog grows with the bank, and nothing bounds it.** Every player receives every puzzle's title, author, and source on join, including players who cannot start anything. There is no pagination and no search. The filters do not help: they narrow what is drawn, out of a catalog already sent whole. → [ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)
- **The streak is room-scoped and dies with the room.** Surviving an empty room would mean revisiting the no-database decision.
- **Attribution as a lens is designed and not built**, including its cost of hiding the cursor while raised. → [ADR-0013](adr/0013-attribution-is-a-lens.md)

Settled by measurement or playtest: LWW does not feel bad; per-player forward-only undo does not surprise people; clue lists behind a button work as a launching point; Lit is fast enough for a 25×25; KenKen at 7×7 fits inside a pool refill; Fraunces `WONK` and the paper texture are both kept. Details in [TODO.md](TODO.md#open-questions).

---

## 15. Verification

- **Co-op sync**: `npm run dev`, two browsers, create plus join, type into the same cell from both. Last writer wins in both views, presence stripes track, no desync. Kill one client's network briefly and confirm gap recovery.
- **Reconnect**: hard-refresh mid-solve; identity, colour, host status, board state, and elapsed timer all return.
- **Solution secrecy**: no socket frame contains solution values before completion. Automated, and verified to fail against a deliberately leaked snapshot. A frame is reduced to its capitals before searching, because a leak travels one cell at a time as `["C","L","O","S","E"]`.
- **Completion flow**: solve in two browsers; both get the modal with the same server-computed time, only the host sees new-puzzle controls, streak increments. Repeat via Reveal and verify it resets to 0 and skips the wave.
- **Room GC**: shorten the sweep interval in config, leave a room empty, confirm deletion and timer cleanup.
- **Generators**: `npm test` runs the uniqueness property tests.
- **Brand**: both themes at 320px and 1440px, contrast on every token pair, and the app rendering correctly with fonts blocked.
- **Full check**: `npm run lint && npm run typecheck && npm test && npm run build`, then run the production build as one process and replay the co-op scenario against it.

---

## 16. Design decisions

| Decision | Original design | Why it changed | When |
|---|---|---|---|
| Every type types on our own pinned pad, QWERTY for letters | Crossword took the platform keyboard through a hidden `<input>`, with a control bar riding on `visualViewport` | Half a solver's ordinary actions dismiss the keyboard, and a bar positioned against a viewport somebody else animates lags it ([ADR-0010](adr/0010-one-pinned-input-panel.md)) | Phase 4b, 2026-08-06 |
| Crossword letters come from a pad of ours | A pad (Phase 4), then the platform keyboard (4a), then a pad again (4b) | Decided three times. The first playtest asked for the arrangement thumbs know; the second showed the platform owning the bottom of the screen was the real cost. QWERTY answers both | Phase 4b, 2026-08-06 |
| The whole panel is `position: fixed` at the foot of the viewport | Controls laid out in the page flow under the grid | A control in the flow scrolls away, and a 15×15 or 20×20 grid must be scrolled while typing | Phase 4b, 2026-08-06 |
| Notes is one setting in the panel's button bar | A `Notes \| Solve` segmented pair down the page | Two segments implied two independent choices when there is one setting whose off state is Solve, and the control belongs with the keys whose meaning it changes | Phase 2 |
| The clue strip's press is **next clue** | The press was the direction toggle | One strip, two candidate actions: moving on happens dozens of times a puzzle, turning around only when a crossing goes wrong | Phase 4a, 2026-08-05 |
| Cursor 62%, entry wash 13% | 34% and 30% | Four percentage points of one accent is a difference nobody can see; solvers lost the cursor inside a highlighted fifteen-square run | Phase 4a, 2026-08-05 |
| Typing steps over filled crossings and stops at the end of the entry | Typing overwrote the next square and ran on | A half-filled entry could not be typed into, and the letter being overwritten is usually somebody else's | Phase 4a, 2026-08-05 |
| Backspace clears and steps back, never leaving the entry | Backspace only cleared | A held key should walk a wrong answer out of the grid | Phase 4a, 2026-08-05 |
| Puzzle Select shows a banked type's puzzles as a list of cards | The same three questions used for generators: type, size, difficulty | A banked puzzle has a title, an author, and a publication; asking a host to describe one serves a random member of the set they described ([ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)) | Phase 4a, 2026-08-06 |
| The card list carries size and difficulty filters | No filters, rejected as clutter at four puzzles | A bank with two sizes and three difficulties made the list worth narrowing; the clutter case is answered by drawing a row only where the bank has more than one value | Phase 4b, 2026-08-07 |
| Landing is `Create` / `Join` tabs over one form | Both paths shown at once | Two buttons and three fields with nothing saying which button the code field belonged to | Phase 2 |
| `Reveal` (with a confirm dialog) | The mock's `Solve` | It collided with the input-mode toggle, and it is destructive | Phase 2 |
| Presence is a stripe on the cell's bottom edge | Up to three dots in the top-right with a `+n` | Presence was drawn in the content area at a size that grew with the room: it covered the pencil mark and ran out of room at four players | Phase 4b, 2026-08-07 |
| Your own cursor is drawn in your own colour | Every cursor was `--accent` | Two people over one screen could not tell whose cursor was whose, and a player's colour now means one thing everywhere | Phase 4b, 2026-08-07 |
| Room code, seat count, and roster are one panel with a rule and no fill | Three centred lines with nothing grouping them, on `--paper-raised` | The stack read as a screen above the real one, and a filled panel read as a card to be dealt with rather than a caption on the room | Phase 4b, 2026-08-07 |
| `Leave Room` sits in the action row at full size, marked `--danger` | Smaller and set apart below the row | It was the only button on the screen at its own size, which read as an afterthought rather than as quiet | Phase 4b, 2026-08-09 |
| The footer is two icon buttons over two links, with `<pt-about>` | A labelled theme switch, a version line, and a link stacked down the page | A button changes the app and a link leaves it; the version line moved into About, which is where the rest of that answer now lives | Phase 4b, 2026-08-09 |
| `game:start` covers starting and restarting | A separate `game:newPuzzle` event | Starting from `select` and from `solved` differ in nothing but the state they leave | Phase 2 |
| A cell holds a value or marks, never both | A `marks` op preserved the cell's value | Undoing back to a marks-only state silently left the old digit in place; one op per cell state is what makes undo a single write | Phase 2 |
| Crossword entry lookup lives in `client/boards/` | Listed under `shared/puzzle-doc.js` from Phase 0 | `shared/` is what both sides need, and the server never asks what an entry is | Phase 4, 2026-08-03 |
| Cell values are 1–8 characters on the wire, bounded per type | Exactly one character, bounded by `schema.js` | A rebus square is a standard device and a themed crossword is often built on it ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)) | Phase 4, 2026-08-03 |
| `checkCells` needs no block-skipping | Planned as `checkCellsByValue` skipping blocks | `checkPuzzle` already passes `editableIndices(doc)`, which excludes blocks; the planned work did not exist | Phase 4, 2026-08-05 |
| 15×15 crossword carries no small-screen caution | Planned to be marked like the 20×20 nonogram | Measured: 19px squares at 320px with no overflow, which is what every crossword app ships | Phase 4, 2026-08-05 |
