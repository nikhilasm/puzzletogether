# ADR-0013: Attribution is a lens, not a colour on the puzzle

- **Status**: Proposed. Designed, tabled before implementation
- **Date**: 2026-08-27
- **Context**: [brand.md §3](../brand.md#3-color), whose third hard rule this qualifies · [ADR-0001](0001-shared-state-lww-per-cell.md), which is why `CellState.by` exists · [architecture.md §6](../architecture.md#6-client-structure) · [design-spec.md §4](../design-spec.md#4-the-game-screen)

## Context

Anyone in a room should be able to turn on a view showing **who filled which squares**, each cell washed in the colour of the player who wrote it. Client-side, per player, toggled by everybody rather than by the host.

Two facts shape the decision.

**The data has been there since Phase 1 and nothing has ever read it.** Every cell carries `by`, the `playerId` of its last writer: the server stamps it on the board write and on the echo, the client stamps its own optimistic writes, `toSnapshot()` carries it to late joiners and through gap recovery, and `revealPuzzle()` leaves it `null` because a revealed cell was written by the room. It exists because ADR-0001's LWW needs to know who the last writer was. Its typedef says what it was kept for, and that it must not tint values.

**And brand.md names this feature as the thing colour must never do.** §3's third hard rule: player colour never tints puzzle content, because a wash under a square says who is *looking*, which is presence, while a coloured value would say who *wrote* it, which is attribution.

So the request is the rule's own named counterexample, and the reserved field carries the prohibition in its comment. Neither can be quietly edited around.

## Decision

**Build it as a lens: a view a player raises to look at a grid, not a mode they solve in.** Five choices make it that, and they are one decision in five places.

### The rule survives verbatim; the surface is what moves

The prohibition is on **values**, in both places it is written. This design tints the grid's **surface** and never its content: an entered value stays `--ink` whoever wrote it, and check feedback remains the only thing allowed to recolour one.

That surface is already shared ground: the cursor wash, the entry and row/column washes, and the solve wave are all player colour painted under the puzzle rather than on it. So the boundary moves narrowly:

> Colour may wash the grid's **surface**, on request, to say who wrote a square. It still never touches a **value**. Presence is drawn unasked because it is happening now; attribution is drawn only when asked for, because it is a question about the past.

`brand.md` §3 and the `CellState.by` typedef are amended to that wording in the same commit as the code.

### It is drawn by a fourth layer, not by `<pt-cell>`

`<pt-attribution-layer>`, alongside the presence and celebration layers: absolutely positioned over `.frame`, `pointer-events: none`, both grid axes declared, one keyed div per attributed cell at roughly 20% of that player's `--player-N`. Mounted **before** the presence layer, so a presence stripe paints over an attribution wash rather than under it.

Two reasons, both precedents:

- `<pt-cell>` is the element whose per-update cost decides whether a 25×25 stays smooth. The celebration wave refused to grow it a branch and this refuses for the same reason.
- A cell background would compose differently in every puzzle type. `[given]` tints with `background-color`, the base washes paint `background-image`, and crossword and nonogram use the `background` shorthand, which resets a `background-color` set from outside. An attribution tint on the cell would survive under the cursor in sudoku and kenken and vanish under it in crossword and nonogram.

Which cells tint is one predicate, `value != null && by != null && players.has(by)`, and every exclusion falls out of it: givens live in `doc` rather than `board.cells`, blocks likewise, a revealed grid carries `by: null` throughout, and a cleared cell keeps its writer's `by` but has no value.

### The cursor's washes stand down while the lens is on

Both are player colour on one surface, and a crossword's cursor is 62% of your own hue against an attribution tint at 20% of somebody's: two strengths of one channel asked to mean two things in the same square.

So the lens withholds `?selected` and `?highlighted`, the mechanism the solve wave already uses. `aria-selected` is untouched: the selection is still real and typing still works, only its paint is withheld. This is what makes it a lens. You raise it, you read the grid, you lower it.

### An unresolvable writer draws nothing

A departed player's `playerId` is gone from the roster, so the tint is not drawn. This is honest and it is the only safe answer: `dropPlayer()` releases the colour and `nextColorIndex()` hands it to the next joiner, so painting a departed player's cells in "their" colour would put two people on one hue, the precise ambiguity the server's uniqueness rule prevents.

### It is off by default and remembered nowhere

Store state beside the brush and the Rebus switch, reset on a new puzzle by `#acceptSnapshot`. It is a question you ask, not a preference you hold.

The control lives in the puzzle-action row, with `aria-pressed` and its word beside its icon: brand.md's "pressed once or twice" tier, which is what a lens is. Not the input panel, which holds the one setting that changes what a keypress means, and this changes no keypress.

**Colour is not the only channel.** Ten player hues cannot survive brand.md's grayscale check, so with the lens on an attributed cell's `aria-label` gains `filled by <name>`, after the value and before any check state, and the layer's divs carry the name as a `title`.

## Consequences

**Good**

- **No server, no protocol, no `shared/` logic.** The only `shared/` edit is the typedef sentence that forbade this. Every mechanism it needs was built for ADR-0001 and is already correct.
- **The prohibition in brand.md §3 is not weakened where it was doing work.** A value's colour is still fixed, and check feedback is still the sole exception.
- **Every exclusion is structural**, falling out of where the data lives rather than a list of cases somebody keeps current when a fifth type arrives.
- **It answers a question a co-op app should be able to answer**, which today is only askable out loud.

**Bad, and accepted**

- **The lens hides your cursor.** The price of not having two strengths of one channel mean two things, and the thing most likely to come back from a playtest. Carried as [open question 16](../TODO.md#open-questions).
- **A player who leaves and rejoins loses their own attribution**, because they return with a new `playerId`. A refresh is fine; walking out and back is not, and there is no fix that does not keep dead ids alive somewhere.
- **Nonogram barely reads.** A 20% wash over a solid `--ink` square is close to invisible. Same limitation already accepted for the presence stripe on filled squares, with the same non-answer.
- **Attribution is last-writer, not solver.** If one player types a wrong letter and another corrects it, the square belongs to the corrector. The control must not be worded as "who solved it".
- **Undo re-attributes.** Undo is a forward-only new write, so walking back your own edit stamps you on the restored value.
- **The layer redraws on every op**, where presence redraws only focused cells: up to ~600 divs on a 25×25, keyed so Lit diffs rather than rebuilds. Only while the lens is on, and only ever a wash, but it is the one number worth measuring.
- **The action row already wraps at 480px with a host's four buttons**, and a fifth control deepens it.
- **A nineteenth icon**, where brand.md says the eighteenth should have been a decision and not a reflex. This one is a decision, and the count moves with it.

## Alternatives rejected

**Put the toggle in the input panel.** That slot is the one setting that changes what a key means, four labelled controls already take 236px of the 296px a 320px screen has, and the thing being toggled is not about the square you are on.

**Put it in the footer beside the theme.** It is a per-viewer view preference, which is the argument, and it is also the furthest point from the grid it changes. The footer is the app; this is the puzzle.

**Keep a departed player's colour by caching the roster at write time.** Their `colorIndex` is re-issued to the next joiner, so the grid would show two people in one hue with no name beside either.

**Draw attribution faintly enough to coexist with the cursor.** Makes the tint the quietest thing on the grid precisely when it is the thing being looked at. The cursor is 62% in a crossword because a playtest found solvers losing it at 34%; ducking under that leaves attribution too faint to read.

**Give the cursor a non-colour marker so both can show at once**, a ring on the selected square while the lens is on. The best of both, and a new cell treatment that has to work across four board types, coexist with crossword's circled squares (already a `--graphite` ring), and be added to the element this ADR has just declined to grow. Worth revisiting if the playtest says losing the cursor is the problem.

**Persist the lens like the theme.** A remembered preference is right for something you live in. A solver who left it on last week and cannot find their cursor today has a bug rather than a setting.

**Broadcast the toggle so the room sees it together.** A new event, a new bit of room state, and a host question about who may flip it, for a rendering choice that costs one player nothing to make alone. Notes, the brush, and Rebus are all per-player for the same reason.

## What to check before this is accepted

1. **Measure the layer at 25×25 with the lens on**, against Phase 1's numbers (19ms first render, 2.9ms median per-cell update). A design that claims to be cheap should say how cheap and be checked, which is [ADR-0012](0012-a-label-under-every-icon.md)'s lesson.
2. **Look at a finished nonogram with it on.** If the wash over filled squares reads as nothing, then for one of four types this feature does not exist, and that should be known before it ships.
3. **Play a crossword with it**, to find out whether losing the cursor makes it a lens or makes it useless.
