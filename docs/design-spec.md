# PuzzleTogether — Design Spec

> **Status**: approved · **Branch**: `feature-puzzletogether` · **Last updated**: 2026-08-05
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
   ├─ 0006-jsdoc-checkjs-for-type-safety.md
   ├─ 0007-rebus-widens-the-cell-value.md
   ├─ 0008-native-keyboard-for-crossword.md   # superseded by 0010
   ├─ 0009-a-bank-is-browsed-not-described.md
   └─ 0010-one-pinned-input-panel.md
```

Each ADR uses the standard short form — Context / Decision / Consequences / Alternatives rejected — and captures *why*, since every one of these has a plausible-looking alternative that was deliberately declined.

**A superseded ADR is kept and marked, never rewritten.** 0008 lost to 0010 in a day, and the record of *why it looked right* is the part worth having — a decision reversed by evidence is a different thing from a decision that was never made.

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

### The input panel

**Every puzzle type is typed on a pad of ours, pinned to the foot of the viewport** ([ADR-0010](adr/0010-one-pinned-input-panel.md)). One `<pt-keypad>` element serves all four types; what differs is only what is in it.

It reads, top to bottom:

1. **The clue strip** — crossword only, and also its next-clue button.
2. **The button bar** — this type's one setting (Notes, a brush, or Rebus), then Erase and Undo, plus crossword's `All clues`.
3. **The keys** — digits `1..n` sized to the puzzle's alphabet, or the three staggered **QWERTY** rows with ⌫ on the end of the last.

**Fixed rather than laid out with the page, which is the whole point of it.** A control in the flow scrolls away, and a grid too tall for the screen has to be scrolled: a 15×15 crossword and a 20×20 nonogram are both taller than a phone. Pinning the keys means the grid above them can be scrolled, read, and worked while the ability to type never goes anywhere. Phase 4a took the opposite bet — crossword on the platform's keyboard, with a control bar riding above it on `visualViewport` — and a playtest on a real iPhone found the keyboard fine and everything around it unusable: half of a solver's ordinary actions dismiss it, and the bar it displaces lags behind it.

Because the panel is out of the flow it takes no room, so **the page reserves its measured height at its very foot** — in `<pt-app>`, after the footer, not in `<pt-game>`. A spacer inside the game screen leaves the footer's theme switch underneath the keys and unclickable at every scroll position, which is exactly what happened the first time.

**Scope is what puts a control here.** Everything that acts on *a square* is in the panel; everything that acts on *the puzzle* — Check, Reveal, Puzzle Select — stays down the page. That was Phase 2's rule, drawn as a hairline under a row; it is now the difference between two kinds of place, which says the same thing without having to be read.

It routes through the same op path as physical keyboard input and respects the Notes/Solve mode. It stays visible on desktop, not just touch — for the digit types it doubles as an affordance showing which digits remain available.

**Undo is in the button bar**, beside Erase, rather than with Check and Reveal. The mock has no Undo control, and Ctrl+Z is not a thing a phone has — so it needed a button, and putting it with Erase keeps every way of changing a cell in one place. Ctrl+Z still works when the grid has keyboard focus.

**Every control in the panel suppresses focus on `pointerdown`.** Without it, pressing Notes or Rebus blurs the grid and the next physical keystroke goes nowhere — a failure that is invisible on a touch screen and immediate on a desktop.

**The letters are QWERTY, not A–Z.** Alphabetical rows are easier to search, which sounds like the right answer until you notice nobody searches a keyboard they have used ten thousand times. The arrangement is the one thing a pad of ours can borrow from the platform keyboard it replaces, and it is most of what the earlier playtest was reporting.

**Nonogram takes the same slot with `Fill · Cross · Erase`** — a tri-toggle, because picking a brush changes what the grid does next rather than changing the grid, the same distinction that makes Notes a switch and Check a button. It replaces *both* the Notes switch and the digits: a nonogram has no digits to press, and no pencil marks either, because the cross **is** the note. Three mutually exclusive states is one more than a switch can hold, so it borrows the `aria-pressed` option-group pattern from the puzzle pickers.

**Erase leaves the row for nonogram and for crossword; Undo never does.** Erase clears the selected cell — the counterpart to pressing a digit into it — so a puzzle with no digits has no use for it, and nonogram erases by dragging with its erase brush. Crossword's counterpart is the ⌫ key on the pad, where a keyboard puts it. Undo belongs to every type there will ever be.

**A tap paints one square and a drag paints a run**, batched into a single `fill` op on release. What the whole stroke will write is decided from its first square: starting on a square that already holds what the brush paints means the stroke *erases*, so one gesture covers both painting a run and taking it back, and a mis-tap is undone by tapping again. Deciding per square would leave a checkerboard behind. The drag locks to the row or column it started along, because nonogram runs are straight and an unlocked drag on a phone paints whatever the thumb wandered over. One drag is also **one press of Undo** — five presses to walk back one gesture would make the control useless on a 20×20.

**The run is washed in the accent as the drag covers it, before anything is committed.** A stroke lands on release, so without this the grid says nothing until the gesture is over — and laying a run of a particular length against a clue is the entire reason to drag rather than tap. The wash is deeper than the selected cell's, because it has to stay legible over the marks already in the run, and it gives way to the marks themselves in the same frame the op is applied optimistically. `isHighlighted` is the `<pt-board>` hook behind it, and it is the same one crossword will use to highlight the entry under the cursor.

**A filled square fills its whole cell.** Adjacent fills then meet, so a run reads as one bar the length of its clue — which is the thing a solver is counting. Inset blocks read as a row of separate dots that have to be counted one at a time. The hairlines still draw over the top, so the grid is a grid.

**Nonogram draws a heavier rule every five squares.** It divides nothing — a nonogram has no regions — but matching a clue of 7 to a run of squares is guesswork on an unmarked 20×20 and immediate on a grid banded in fives. The bands are the **hairline's colour at three times its weight**, not `--ink`: in the fill colour they read as filled squares that happen to be thin, competing with the picture they exist to help measure. The outer frame keeps its `--ink` edge in every type.

### Crossword

Crossword is the first type whose puzzle is not entirely visible in the grid. A sudoku shows you everything it knows; a crossword keeps half of itself in a list. Every decision below follows from that one difference.

**The current clue is the top strip of the input panel.** It is the single thing a solver needs at every moment, so it is the single thing always on screen — and it belongs with the keys that answer it, so that the eye never travels between the question and the letters. **Rebus**, **Undo**, and **All clues** sit in the button bar below it with every other action, rather than crowding the one piece of text on this screen that actually has to be read.

Phase 4a had this as a bar of its own, `position: fixed` and lifted by however much of the window the platform keyboard had taken, measured from `visualViewport`. That went with the keyboard ([ADR-0010](adr/0010-one-pinned-input-panel.md)): with no keyboard but ours, there is nothing to ride above and nothing to measure.

**The clue is a button, and pressing it goes to the next clue in the direction being worked** — 7D to 8D, wrapping at the bottom of the Downs rather than falling into the Acrosses. Revised from Phase 4, where the strip was the *direction toggle*. There is one strip to give away and only one of the two actions can have it: moving on is what a solver does dozens of times a puzzle, where turning around is what they do when a crossing goes wrong. Turning around keeps the gesture it always had — **tapping the square the cursor is already on** — plus <kbd>Space</kbd> and the perpendicular arrow on a keyboard. That leaves it with no button on a touch screen, which is the convention every crossword app teaches and is still the weakest part of the arrangement.

The direction is written **`7D`, not `7 Down`.** The strip holds a number, a clue, and an arrow, and four characters of every entry is a real cost; the abbreviation says nothing a solver cannot already see in the grid. The full words stay in the button's accessible name, where nothing is competing for the space.

**Distinct from Tab**, which walks the printed clue list and so does fall out of the Acrosses into the Downs. Both behaviours are wanted; they are different questions.

**The full Across and Down lists open over the grid, behind one `All clues` button.** Two scrolling lists and a 15×15 grid do not fit a phone together, and on the desktop column they would take the grid's width to show a list the solver reads once per entry. So the lists are a place you go, not a thing you sit beside: they open as a dialog, the current entry is marked, picking any clue jumps the cursor to its first square and closes. The trade is real and is accepted deliberately — scanning for a way in becomes a deliberate act rather than a glance, which is the cost of keeping the grid the loudest thing on screen (§3). The bar is what makes it affordable, since the clue you are *on* never requires the dialog.

**Letters come from a QWERTY pad of ours, in the input panel** ([ADR-0010](adr/0010-one-pinned-input-panel.md)). This has now been decided three times. Phase 4 built a pad; Phase 4a replaced it with the platform's keyboard after a playtest said solvers want the layout their thumbs know; Phase 4b brought the pad back after the next playtest said the keyboard is fine and *the screen around it* is not — half a solver's ordinary actions dismiss it, and a control bar riding on `visualViewport` lags behind it.

The two findings are not in conflict, and the pad answers both: the arrangement is QWERTY, so thumbs still know where the letters are, and the layout is ours, so nothing on the screen moves. What is genuinely given up is word suggestion, swipe typing, and dictation — which is the honest cost, recorded in §14.

Because the keys are ours, crossword's keystrokes are read the same way every other type's are: on the grid, from `keydown`. The offscreen `<input>`, the `beforeinput`/`inputType` reader, the Android IME workaround, and the `<pt-board>` hooks that existed to serve them are all gone.

**A square holds one letter unless the player says otherwise.** Typing replaces the square's contents and moves on. With **Rebus** on, typing appends instead, and the square holds a whole word — the device a themed crossword is often built around ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). It is a switch in the panel's button bar, which is where every type keeps its one setting — Notes for the digit puzzles, the brush bar for nonogram. Holding <kbd>Shift</kbd> does the same thing for one keystroke on a physical keyboard; **on a touch screen the switch is the only path**, since our pad has no Shift key to offer and a phone's own produces an uppercase letter and no separate signal.

The value grows to fit the square down to a floor: a rebus of two to five characters is set to fit the width, and past that the size holds and the text clips, with the whole string still in the square's `aria-label`. Shrinking without a floor would make a long entry unreadable in the name of showing all of it.

**Navigation is what a crossword solver already expects, and it is worth being literal about it**, because guessing here is immediately annoying:

- Typing advances to the next square in the current entry, **stepping over squares that already hold a letter**, and **stops at the end of the entry** rather than wrapping into the next one. Jumping the crossings is what makes a half-filled entry typable: with `FR__T` on screen, `U`-`I` has to produce `FRUIT` and not `FUIT_`, and in a room solving together the letter being overwritten is somebody else's. Filling the last square is a moment to look up, not to be moved somewhere unannounced.
- <kbd>Backspace</kbd> **takes the letter out and steps back**, so a held key walks a wrong answer out of the grid a square at a time. It never leaves the entry: at the first square it empties it and stops. On a rebus square mid-assembly it peels one character and **keeps** the cursor, because that is the correction the player means. <kbd>Delete</kbd> is the same rule minus the step. The pad's own ⌫ key is the same act, asked of the board rather than reimplemented — and it is why crossword has no Erase control, the same reasoning that took Erase off nonogram's brush bar.
- Clicking a square selects it; clicking the **selected** square flips direction.
- <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> move to the next and previous entry in the printed clue list, running off the end of the Acrosses into the Downs. The clue bar's button is the other thing — the next entry *in the same direction*.
- Arrow keys along the current direction move the cursor. Arrow keys **across** it move the cursor *and* flip the direction, which is the one rule people rely on without being able to state.
- Blocked squares are never selected, by click or by arrow — they hold nothing and cannot be typed into.

**The cursor is a solid statement of position and the entry around it is barely a tint.** Both are the accent, at 62% and 13%. Phase 4 shipped them at 34% and 30%, a difference nobody can see, and the first thing the playtest reported was losing the cursor inside a highlighted run of fifteen squares. The two washes answer different questions — *where am I* and *which word am I in* — and the second only has to be distinguishable from no wash at all.

**A square's number is sized by the square, not by the page.** It was a flat `--text-sm` at a flat 2px inset, which is right at the 40px cells a mini gets and wrong everywhere else: a 15×15 on a phone is 19px squares, where 12.8px of number is two thirds the cell and swamps the letter under it — and a fixed 2px inset is a different *proportion* in every grid, so the numbers stopped reading as a column down the left edge. Both complaints were one measurement. It now scales with `--cell-size`, floors at 7px so a 25×25 keeps its numbering, and is capped at the old size so nothing gets a larger number than before.

**Black squares are `--ink` and carry no number, no cursor, and no presence dot.** They already render this way; what Phase 4 adds is that they stop being reachable. **Circled squares** — `GEXT` in the source files, and where a themed puzzle usually hides its bonus answer — draw as a thin ring inset in the square, in `--graphite` so they read as an annotation on the grid rather than as a value in it.

**The clue list is synchronized with your own cursor, not with the room's.** It follows your position and direction and scrolls the current clue into view; where everyone else is working stays where it already is, on the grid as presence dots. Adding direction to `game:focus` would let the list say precisely which entry each player is on, and it is deliberately not built: it is a protocol change in the phase whose premise is that a new type needs none, bought for a nicety. Recorded as a candidate for later, once real play says whether the dots are enough.

**15×15 needs no caveat on small screens, which the design expected it to.** The plan was to mark it in Puzzle Select the way the 20×20 nonogram is marked; measuring it said otherwise. At 320px a 15×15 comes out at 19px squares with no horizontal overflow, which is what every crossword app on a phone ships and is nothing like the 20×20 nonogram's ten-pixel squares with a third of the width lost to clue gutters. A crossword also has no gutters to lose it to and never draws nine pencil marks in a square. So the caution is not written, and `SIZE_CAUTION` has no crossword entry.

What the small screen costs instead is **vertical**: the panel takes about 16rem — clue, button bar, three rows of letters — and the grid gets the rest, which at 320px is enough for a 15×15 at 19px squares. That is more than the platform keyboard and its one-row bar took, and it is the price of a screen that never moves. **Unlike the keyboard's share, ours is a number we chose and can revisit**, which is the other half of what the change bought.

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
├─ scripts/import-crossword.js # .puz/.ipuz → a bank file; run by hand, never at boot
├─ Dockerfile  .env.example  .github/workflows/ci.yml
├─ docs/                       # see §1
├─ data/crosswords/
│  ├─ index.json               # manifest: id, file, size, difficulty, title, author, source, license
│  └─ mini-0001.json …         # the finished doc + its solution
├─ data/crosswords-local/      # gitignored overlay: prototype imports, never committed (ADR-0004)
├─ shared/                     # imported by BOTH server and client
│  ├─ protocol.js              # event constants, PROTOCOL_VERSION, JSDoc typedefs
│  ├─ schema.js                # ~120-line runtime payload validator
│  ├─ constants.js             # player palette, limits, timings
│  ├─ puzzle-doc.js            # idx↔(r,c), cell helpers — nothing type-specific
│  └─ board-reducer.js         # applyOp() — shared by server and client
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
   ├─ views/{pt-app,pt-landing,pt-puzzle-select,pt-game,pt-congrats-modal,pt-confirm}.js
   ├─ ui/{pt-player-chips,pt-timer,pt-keypad,pt-mode-toggle,pt-brush-bar,pt-switch,pt-puzzle-picker,icons}.js
   │  # pt-keypad is the pinned input panel for every type: clue slot, action bar, keys (ADR-0010)
   │  └─ {pt-clue-bar,pt-clue-list}.js   # crossword's clue strip and its clue dialog
   └─ boards/{registry,pt-board,pt-cell,pt-presence-layer,pt-sudoku-board,pt-kenken-board,pt-nonogram-board}.js
      └─ {pt-crossword-board,crossword-entries}.js     # Phase 4: entry lookup beside its consumer
```

**Dev**: Vite on 5173 with `server.proxy` sending `/socket.io` and `/api` to Express on **3001**; `npm run dev` runs both via `concurrently`. Both sides read `PORT` from the same place, so the proxy and the Express process cannot disagree — the default moved from 3000 and the proxy followed it.
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
| crossword | `{ entries: [{ num, dir: 'A'\|'D', cells: [idx], clue, len }], alphabet: 'A…Z', circled: [idx] }` | letter, rebus word, or null |

**Nonogram's two values are single characters, and it names them in its own `meta`.** Named in `meta` rather than agreed as a shared constant because the board is then reading *what this puzzle uses* rather than knowing what nonograms use — the same reason sudoku's alphabet travels in the document.

**A cell value is 1–8 characters on the wire, and each type narrows that itself.** Through Phase 3 the bound was exactly one character, and §7 argued that the rule held for four types precisely because none had been allowed to widen it. Phase 4 widened it, for rebus squares, and the reasoning is in [ADR-0007](adr/0007-rebus-widens-the-cell-value.md): `schema.js` exists to bound what crosses the wire, not to describe puzzles, and what may go in a cell is what `validateOp` is for. Sudoku, kenken, and nonogram accept exactly one character each, as they always did — the difference is that they now say so themselves.

**So a new type must bound its own values, and nothing will remind it.** This is the one piece of discipline Phase 4 moved out of the schema and into review. It is also where the widening turned up a bug that had been invisible behind the old rule: sudoku and kenken tested membership with `doc.meta.alphabet.includes(value)`, which on a string matches *substrings*, so `'12'` would have passed the moment a two-character value could reach it. Fixed to a character-set test in the same change. The general lesson is worth keeping: a check that has never been wrong may only be a check that has never been reached.

**Nonogram has no pencil marks**: the cross *is* the note, so it lives in the cell's value and `marks[]` stays empty. This is also why nonogram is the one type whose `isComplete` cannot be the shared value-grid comparison — a grid is solved by its **filled** squares alone, whether the player marked the blanks, marked them wrongly, or left them alone.

**KenKen labels its cages through `DocCell.label`**, which already draws in a cell's top-left corner. The server writes `12+` or `3÷` onto each cage's first cell and the board never renders a label itself.

**A clue and a note both want that corner, so the clue is given a row of the mark grid.** A mark's position *is* which digit it is, so note "1" is always top-left, and marks paint after the label — a cell with a full set of notes hid the clue it was there to solve. The board declares `reservesLabelRow`, the cell adds a row to the mark grid and starts the notes one row down, and the clue is then sized by that track instead of by `--text-sm`. It was the only thing in a cell not derived from cell size, which meant it grew relative to its neighbours exactly where space was tightest. The cost is one row of note height, which is real at 7×7 on a phone and invisible at 4×4.

**A label is drawn and it is also said, and those are two different jobs.** `<pt-board>` puts `DocCell.label` into the cell's `aria-label` — it did not until Phase 3 closed, so a kenken puzzle's entire set of constraints was missing for anyone not looking at the screen. Saying it is not simply reading it: a clue is written to fit a corner a few pixels across, and at a screen reader's usual verbosity punctuation is skipped, so `12+` and `12` are announced identically while meaning nothing alike. The `spokenLabel` hook lets the subclass supply the phrase — kenken says "cage 12 plus" — because only the subclass knows what its label *means*, and the base element has no business knowing that kenken's labels describe cages. **A blocked square says "blocked" and stops**: it holds no value, takes no marks, and cannot be checked, so "empty" would invite an edit that is not possible.

**Server module interface** — each `server/puzzles/<type>/index.js` default-exports:

```js
{
  type,
  create({ difficulty, size, rng }) → { doc, solution },   // generated types only
  validateOp(doc, op) → boolean,
  isComplete(doc, board, solution) → boolean,
  checkCells(doc, board, solution, idxs) → { [idx]: 'correct'|'wrong'|'empty' },
}
```

**Phase 4 found that this is two interfaces wearing one name.** `create` *produces* a puzzle; the other three *rule on* one. Three types needed both because they make their own puzzles, so the distinction never had to be drawn — and crossword, whose clues are written by a person, has nothing to generate. Its module supplies the rules only, and `provider.js` is what knows which of the two producers a type has, which is exactly the seam it was built to be. A fifth generated type still writes all four; a second banked type writes three.

The rules themselves turned out to be almost entirely borrowed: a crossword cell holds one value compared against one solution value, which is the sentence `value-grid.js` already said for sudoku and kenken. A letter is not different from a digit in any way those functions can see. The only method genuinely crossword's own is `validateOp` — what may be written into a square.

**Provider seam** — `server/puzzles/provider.js` exposes `getPuzzle({ type, difficulty, size, puzzleId })`, backed by `GeneratorProvider` (sudoku/kenken/nonogram) and `BankProvider` (crossword). Identical interface, so a future DB provider drops in with no call-site change. → [ADR-0004](adr/0004-hybrid-puzzle-supply.md)

**A generator can make anything it offers; a bank holds what it holds — so the provider also publishes a catalog.** Puzzle Select has read its options from `SIZES_BY_TYPE` in `shared/constants.js` since Phase 2, which is exactly right for a type whose content is produced on demand and cannot be right for one whose content is a directory of files. `provider.catalog()` returns what is genuinely available per type, computed once at boot, and the server sends it with room state so the picker offers what exists rather than what a constant hopes exists.

Three things follow, and they matter more than the mechanism.

**A type with nothing behind it is not offered at all**: a build whose crossword bank is empty shows three puzzle types, not four with one that fails when picked — which is the state any build without a licensed bank is in, so it is the normal case rather than an error case (§14).

**Crossword sizes are not square sides.** `SIZES_BY_TYPE` holds a side length per type because every generated grid is square; real crosswords are 15×15 and 5×5 and also 20×21, so the catalog carries `{ rows, cols }` pairs and Puzzle Select labels them as it finds them.

**And a banked type also lists its puzzles by name, because a bank is browsed rather than described** ([ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)). This was the part Phase 4 got wrong. A banked puzzle has a title, an author, and a publication; two 15×15s of the same difficulty are two pieces of writing by two people, not two specimens of a class the way two sudokus are. Asking a host to describe one is asking them to guess at a list they could be shown, and then serving a random member of the set they described. So `bankCatalog()` carries a `puzzles` array — `id`, `title`, `author`, `source`, `size`, `difficulty` — `game:start` takes an optional `puzzleId`, and **which shape `<pt-puzzle-picker>` renders follows the provider rather than the puzzle type**: a catalog entry with a `puzzles` array becomes a scrolling list of cards, one without keeps the size and difficulty rows.

**A room does not serve the same banked puzzle twice running.** A generator never repeats by construction; a bank of thirty will, immediately and visibly, and "start another" landing on the puzzle just solved would read as the button being broken. The room remembers the ids it has been served. **A named `puzzleId` overrides that**: having pressed a title off a list, the host means that puzzle even if the room has played it.

**Client**: `<pt-board>` owns grid geometry, cell DOM, selection, the presence layer, and op emission. Subclasses supply only cell rendering, the keyboard/keypad map, input filtering, and decorations (cage borders, clue gutters, entry highlighting). A fifth type = one server module + one Lit subclass, touching nothing shared.

The subclass hooks, settled in Phase 3 when two new types actually pulled on them:

| hook | answers | used by |
|---|---|---|
| `isHeavyRight` / `isHeavyBottom` | where the heavy rules go | sudoku regions, kenken cages, nonogram's counting bands |
| `valueForKey` | what a keystroke writes here | all |
| `markColumns` / `markRows` | how pencil marks lay out | sudoku, kenken |
| `reservesLabelRow` | whether the cell's label takes a mark row to itself | kenken cage clues |
| `spokenLabel(label, idx)` | how that label is said, when it is not how it is drawn | kenken cage clues; crossword numbers |
| `valueGlyphs` | whether a value is drawn as a character or as a mark | nonogram |
| `renderTopGutter` / `renderSideGutter` | what is drawn alongside the grid, aligned to its tracks | nonogram |
| `isHighlighted` | which cells the gesture in progress covers, as distinct from the selection | nonogram drags; crossword entries |
| `nextSelection(from, dRow, dCol)` | where an arrow key lands, when it is not simply the next square | crossword: skips blocks, flips direction across the entry |
| `advanceAfterInput(idx)` | where the cursor goes once a value is written, or nowhere | crossword auto-advance |
| `isCircled` | whether the square is annotated rather than special | crossword themed squares |

**This table lost two rows in Phase 4b, and that is the interesting part.** ADR-0008 added `renderOverlay` and `focusTarget`, moved key handling from `.grid` onto the host, and added `describeCell` — four changes to the base element, to serve one type's hidden input. It was recorded at the time as one more change than a new type is supposed to need. [ADR-0010](adr/0010-one-pinned-input-panel.md) removes all four: keys are read on `.grid` again, as they were through Phase 3.

The lesson is not that the hooks were badly designed. It is that **the pressure on the base element came from taking input from the platform rather than from the type being new** — the abstraction had "input arrives as keystrokes on the grid" baked in, and it held for every type that types on our keys. A fifth type still costs one server module and one subclass.

**Crossword pulls on navigation the way nonogram pulled on rendering, and the three new hooks are that.** `nextSelection` and `advanceAfterInput` exist because a crossword is the first type where moving the cursor is a puzzle-specific act: everywhere else an arrow key means the adjacent square and typing means stay put, and both were hard-coded in `<pt-board>` because no type had ever disagreed. `isCircled` is a cell decoration of the same shape as the heavy-rule hooks. `spokenLabel` gains the cell index, because a crossword number describes the entries that *start* at a square, which the label alone cannot say — kenken ignores the second argument.

One change to `<pt-board>` is not a hook and not crossword's: **a blocked square is never selected**, by click or by arrow. It holds no value, takes no marks, and cannot be checked, so selecting one could only ever be a dead end. No existing type has block cells, so this costs them nothing — it is the base element finally being asked a question the doc schema has allowed since Phase 0.

**Crossword entry lookup lives in the client, not in `shared/`** — a Phase 0 assumption reversed on the way into Phase 4. §5 listed it under `shared/puzzle-doc.js` from the start, on the reasoning that "which entry is this cell in, and in which direction" is a document question like `toCoords` is. It is not, on the test `shared/` actually applies: **`shared/` is what both sides need**, and the server does not need this. A crossword's server module writes letters into a value grid and compares them to a solution — `validateOp`, `isComplete`, and `checkCells` are the same value-grid code sudoku and kenken already share, and none of the three ever asks what an entry is. Entries are for highlighting the current one, auto-advancing along it, and keeping the clue list in step with the cursor: three rendering and navigation concerns, all of them the board's.

So it goes in `client/boards/crossword-entries.js`, beside the subclass that consumes it, and `puzzle-doc.js` stays free of anything one type knows about. That also keeps Phase 3's result honest rather than honest-by-technicality — the claim is that a new type costs one server module and one client half, and quietly widening the file every type imports is exactly how that claim decays into nothing. Note that `entries[].cells` is stored explicitly in the document, so lookup is indexing rather than derivation; there is no algorithm here that two sides could implement differently, which is the usual reason to force something into `shared/`.

**The board element for a type, and the kind of input it takes, are declared in `client/boards/registry.js`.** The game screen branches on the *input style* — `digits`, `brushes`, and `native` for crossword — never on the type name. Sudoku and kenken share `digits` despite having nothing else in common, which is the point: there are far fewer ways to put something in a cell than there are puzzles. `native` is the answer "the platform's own keyboard", which is why crossword renders nothing in the keypad slot.

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

**A bank file holds the finished document and its solution — the loader validates, it does not compile.** Entry numbering is derived from the grid by one function, `numberGrid()`, and derived *at import time*, so what is tracked in the repo is explicit and reviewable rather than a source form that becomes a puzzle only when the server starts. The same function then runs at boot as a **check** rather than as a step: the loader re-derives the numbering and refuses a file whose stored `entries` disagree with its own grid. Writing it once and using it in both directions is what makes the redundancy worth having — a stored entry list that nothing verifies is just a second place to be wrong.

**Crossword's difficulty is declared, which is a third answer to a question the platform has now answered three ways.** Sudoku's is measured, kenken's is a generation parameter (§8), and a banked crossword's is whatever the manifest says — usually a restatement of the source's day-of-week convention. There is nothing to measure: difficulty in a crossword is how obscure the clues are, which is a property of the writing. It is recorded here so the inconsistency is a decision rather than a discovery.

**The importer refuses more than it converts, and that is the point.** From `.puz` it reads the header, the solution and player grids, the clue list, and the extension sections. It **carries** `GRBS`/`RTBL` rebus squares ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)) and `GEXT` circled squares, since between them they are where a themed puzzle keeps its theme. It **ignores** `LTIM` and `RUSR` — a saved timer and a stranger's partial solve, which are somebody's session and not part of the puzzle. It **refuses**, by name and with the reason, a scrambled puzzle (the solution is locked and cannot be read honestly), a grid outside the schema's 25×25 bound, a rebus longer than `MAX_CELL_VALUE_LENGTH`, and any file whose derived numbering does not match its own clue count.

**It also refuses to write a bank file without an explicit licence.** `--license` is a required argument, not a field it guesses from the source's copyright string; the string is carried into the manifest as `source` alongside it. This is [ADR-0004](adr/0004-hybrid-puzzle-supply.md)'s split made mechanical: the pipeline can be developed against any file, and nothing reaches `data/crosswords/` without somebody having answered the question of what may be served. A prototype run states its licence as unknown and says so in the manifest, which is honest and keeps that puzzle identifiable later.

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
  served: Set,          // banked puzzle ids this room has had, so a finite bank does not repeat
  timers: Set,
}
```

**`served` exists only because a bank is finite.** A generator never hands back the same puzzle twice, so for three of the four types this stays empty; a bank of thirty runs out, and being given the puzzle you have just solved reads as the button being broken rather than as the library being small. It is per room and dies with it, like the streak.

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

**The puzzle catalog rides the `room:create` / `room:join` ack**, not `room:state`. It is fixed for the life of the process — it is what the generators offer plus what the bank was loaded with — so it belongs with `PROTOCOL_VERSION` in the one payload a client receives exactly once, rather than being re-sent with every state change that cannot have altered it. It is the whole protocol cost of the bank: a client that knows what a server can serve needs nothing else to draw Puzzle Select correctly.

**`game:start` carries an optional `puzzleId`**, naming one puzzle out of a bank's catalog ([ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)). It is validated as shape only — 64 characters of `[\w.-]` — because whether the id exists is the provider's question, and a client holding a catalog older than the bank is a restart rather than an error: an unknown id falls back to the size and difficulty beside it. The three generated types never send one.

**Crossword adds nothing else to the protocol.** No new event, no new op type, no new field on `game:op` or `game:focus` — a letter is a `set` and a rebus is a longer `set` ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). The one deliberate omission is direction on `game:focus`: it would let the clue list say precisely which entry each player is working, and it is not built, because the feature is a nicety and the change is to `shared/` (§4).

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
- **Input** flows through one path regardless of source — physical keyboard, the input panel's keys, or touch — branching on the Notes/Solve mode. A tapped key and a pressed key reach the store through the same method, so they cannot mean different things; where a key needs a rule only the board knows (crossword's Backspace, which steps along the entry), the screen asks the board rather than reimplementing it. Crossword adds Tab/Enter direction toggle, auto-advance, and entry highlighting; nonogram adds drag-fill batched into one `fill` op.
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
5. **Bank loader**: every file in `data/crosswords/` validates against the schema and re-derives its own numbering. This is the one place the suite tests *content* rather than code, and it is worth it — a hand-edited grid whose entries no longer describe it is not a crash but an unsolvable puzzle, found by a room mid-solve.
6. **The importer's refusals**, on `.puz` files assembled byte by byte in the test. The real samples are `.gitignore`d, so a test reading them would pass on one machine and fail on every other.

**Playwright** (`npm run test:ui`) for everything that needs a real engine: `tests/` drives the built app against a real server, with a second browser context wherever the assertion is about two players. It covers the landing tabs, the roster and colour picking, removing a player, the ways out of a room, the keypad and switches, and grid geometry. `playwright.config.js` builds and starts the server itself, so the command is the whole setup — and it **never reuses an existing server**, which is the non-obvious part. The `webServer` command builds, so reusing one means testing whatever bundle was current when *that* server started; a process left over from an earlier session once turned a green suite into 21 identical failures against a day-old build. A rebuild per run costs seconds, and a port already in use now fails loudly instead of quietly answering with the wrong app.

**A backtick inside a CSS comment is the recurring self-inflicted wound of this codebase**, and it has now been hit six times. A `css` tagged template ends at the first backtick, wherever it is — so naming an element as `` `<pt-game>` `` in a comment silently truncates the stylesheet and turns the rest of the file into whatever JavaScript it happens to parse as. **The build does not always catch it**: it caught the first five and compiled the sixth without complaint, which then failed at runtime with `pt is not defined` and took every browser test down at once, with no error pointing anywhere near the CSS. The cheap check is `node -e "import('./client/.../thing.js')"` on each changed component — a module that loads is a template that closed. Write element names in comments without backticks.

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

**Phase 4 — crossword + bank.** Bank format, loader, validator, `.puz`/`.ipuz` importer, the provider catalog, clue bar and clue-list dialog, the letter pad, direction toggle and auto-advance, entry highlighting, rebus squares.
*Done when*: a 15×15 puzzle is co-op solvable with synchronized clue-list state.

Unlike Phase 3, this one **knowingly touches `shared/`**: the cell-value bound moves from one character to eight so a rebus square can exist ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). That is the phase's one deliberate exception, and it is a bound rather than a behaviour — no op, reducer, or event changes shape. Anything beyond it is the same failure Phase 3 was designed to detect.

**Phase 4a — the revision pass.** A 15×15 was solved by two people on 2026-08-05, and what came back was a list of things that were *built as designed and wrong in play*. Not a phase in the plan; recorded as one because it is where four of the design's own bets were settled by evidence and two of them lost.

- The letter pad is removed and crossword takes the platform's keyboard, through a hidden input, with a pinned control bar above it. → [ADR-0008](adr/0008-native-keyboard-for-crossword.md)
- Puzzle Select shows a banked type's puzzles as a list of cards rather than asking a host to describe one. → [ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)
- The clue bar's button becomes *next clue* rather than *flip direction*, and the direction is abbreviated to `7D`.
- The cursor and the entry wash are pulled apart, from 34%/30% to 62%/13%.
- Typing steps over filled crossings; Backspace clears **and** steps back, never leaving the entry.
- The cell label is sized off `--cell-size` rather than the page's type scale.

The one architectural cost is in `<pt-board>`: keys are now read on the host rather than on `.grid`, and there are two new hooks (`renderOverlay`, `focusTarget`) so a subclass can own where focus lives. Phase 3's claim was that a new type needs no change to the base element. A type that summons an OS keyboard needed one, and the honest reading is that the abstraction had assumed input arrives as keystrokes on the grid.

**Phase 4b — the input panel.** The next playtest, on an iPhone, reversed the largest decision of 4a. The platform keyboard's *letters* were never the problem; the screen around them was — half of a solver's ordinary actions dismiss the keyboard, and a control bar riding on `visualViewport` lags it. → [ADR-0010](adr/0010-one-pinned-input-panel.md)

- Crossword returns to a pad of ours, **QWERTY**, so thumbs keep the arrangement they know while the layout stops moving.
- `<pt-keypad>` becomes **one pinned input panel used by every type**: clue strip, button bar, keys. Registry vocabulary gains `letters` and loses `native`.
- Everything that acts on a square — Notes, brushes, Rebus, Erase, Undo, All clues — is in the panel; everything that acts on the puzzle stays down the page.
- `<pt-app>` reserves the panel's measured height after the footer, because the panel covers the whole page and not just the game screen.
- **All four of 4a's `<pt-board>` changes are given back.** `renderOverlay`, `focusTarget`, `describeCell`, and the host key listener are removed; keys are read on `.grid` again.

That last point is the one worth keeping. 4a's cost to the base element looked like the price of a fourth puzzle type and was really the price of *borrowing the platform's input*. Taking the input back took the cost with it.

**Phase 5 — hardening.** Tests to meaningful coverage, CI green, Dockerfile, rate limits, load test with N simulated players in one room.

Docs are updated *within* each phase, not after — an ADR that no longer matches the code is worse than no ADR.

---

## 14. Risks and open questions

- **Crossword content licensing is the real blocker for Phase 4 — for *shipping*, and no longer for *building*.** Which puzzles can legally ship is still open; hand-authored minis and public-domain sources remain the safe start. The importer and the bank are developed against freely-distributed `.puz` files, which answers "does the pipeline work" without answering "what may we serve". Those inputs stay out of the repo: free to download is not free to redistribute, and a commit is a redistribution. → [ADR-0004](adr/0004-hybrid-puzzle-supply.md)
- ~~**KenKen uniqueness verification cost** grows sharply with grid size.~~ **Measured in Phase 3 and settled.** It does grow sharply — ~1ms at a 5×5 hard against ~170ms median and 870ms worst at a 7×7 hard — but 7×7 is comfortably inside a background pool refill, so the cap stays where §8 put it. The time budget and retry cap were built anyway, and bound the search for a *good* partition rather than the production of one.
- ~~**Putting the clue lists behind a button is the biggest untested bet in Phase 4.**~~ **Settled by playtest, 2026-08-05 — it holds.** The worry was that experienced solvers scan the list for a way in and that making it a tap would cost too much; in play the dialog works *as* that launching point. The desktop side-panel fallback is not needed and is not built.
- ~~**The letter pad replaces the native keyboard, which is a wager against the platform.**~~ **Settled twice, and the second answer stands.** 2026-08-05: players want the layout their thumbs know, so the pad went and the platform keyboard came in. 2026-08-06, on a real iPhone: the keyboard's letters were fine and the screen around them was not — it is dismissed by half of a solver's ordinary actions and nothing can be pinned reliably above it. **The pad returns, in QWERTY, and is pinned along with every other type's keys.** The two findings agree once separated: the *arrangement* was what solvers wanted, not the platform's ownership of the bottom of the screen. → [ADR-0010](adr/0010-one-pinned-input-panel.md)
- **A rebus is capped at 8 characters** and the discipline that keeps other types at one is now review's rather than the schema's ([ADR-0007](adr/0007-rebus-widens-the-cell-value.md)). A fifth type that forgets to bound its own values gets a bug, not an error.
- **Turning the cursor around has no button on a touch screen.** The clue strip's one press went to *next clue*, so flipping Across/Down is a gesture — re-tapping the square you are on — and gestures are not discoverable by looking. It is the convention every crossword app teaches, which is the whole of the argument for it. It survived the 4b rework untouched and is still the most likely thing to come back from a playtest. → [ADR-0008](adr/0008-native-keyboard-for-crossword.md)
- **The input panel costs about 16rem of a phone screen**, against roughly 3rem for the clue bar it replaces. That is the price of a layout that never moves, and it is a number we chose rather than one the platform imposed — which is the point, but it is untested against a 15×15 in real play. A collapse handle is the obvious lever and was deliberately not built: it is a state a player can be stuck in and a control to explain. → [ADR-0010](adr/0010-one-pinned-input-panel.md)
- **Nobody gets word suggestions, swipe typing, or dictation in a crossword any more.** Anyone who types on their phone that way has lost it, and no arrangement of our own keys gives it back. This is the sharpest edge of ADR-0010 and the one it cannot mitigate.
- **The catalog grows with the bank, and nothing bounds it.** Every player receives every puzzle's title, author, and source on join, including players who cannot start anything. Four minis is nothing and a thousand crosswords is a payload; there is no pagination and no search, and at some size there will have to be. → [ADR-0009](adr/0009-a-bank-is-browsed-not-described.md)
- ~~**`visualViewport` is the only way to know how tall the keyboard is**, and where it is missing the pinned bar may be covered entirely.~~ **Gone with the keyboard, 2026-08-06.** It was named as the one piece of ADR-0008 with no reasonable fallback, and it is what the next playtest actually broke on — not by being missing, but by reporting late. The panel is measured with a `ResizeObserver` on an element we own, which is a question with an answer. → [ADR-0010](adr/0010-one-pinned-input-panel.md)
- ~~**LWW may feel bad** if two players fight over one cell.~~ **Settled by playtest, 2026-08-05 — it feels fine**, and reads as logical rather than as losing work. The soft-lock fallback in [ADR-0001](adr/0001-shared-state-lww-per-cell.md) stays unbuilt, now by evidence rather than by deferral.
- ~~**Shared-document undo is inherently surprising.**~~ **Settled by playtest, 2026-08-05 — it is not.** Per-player forward-only behaves as people expect. The partial case (a drag whose squares have since moved on) did not arise in play and remains unverified in the specific.
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
