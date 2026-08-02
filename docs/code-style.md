# PuzzleTogether — Code Style

> Companion to [design-spec.md](design-spec.md) · [architecture.md](architecture.md) · [ADR-0003](adr/0003-lit-and-vanilla-js-over-typescript.md) · [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md)
>
> Enforced by `eslint.config.js` and `.prettierrc` where a machine can enforce it, by review where it can't. The split is listed in §10.

Vanilla JavaScript with no compile step means the codebase has no type checker forcing consistency on it — only JSDoc, ESLint, and this document. So the conventions here are load-bearing rather than cosmetic.

---

## 1. The four house rules

Everything else in this document elaborates on these.

1. **Indentation is 4 spaces.** Never tabs, never 2, in any file type — JS, CSS, HTML, JSON, Markdown.
2. **Long conditionals split across lines**, one condition per line.
3. **Every function has a comment** saying what it does.
4. **Every class has a comment** describing its role, and **every public method carries a JSDoc block with its full interface** — `@param`, `@returns`, `@throws` where it applies.

---

## 2. Formatting

`.prettierrc` is the source of truth; these are its values and the reasoning where it isn't obvious.

```json
{
    "tabWidth": 4,
    "useTabs": false,
    "printWidth": 100,
    "semi": true,
    "singleQuote": true,
    "quoteProps": "as-needed",
    "trailingComma": "all",
    "arrowParens": "always",
    "bracketSpacing": true,
    "endOfLine": "lf"
}
```

- **100 columns.** Wide enough that a JSDoc line or a Lit template doesn't wrap awkwardly, narrow enough for a side-by-side diff.
- **Semicolons always.** No ASI edge cases to reason about.
- **Single quotes in JS, double quotes in HTML attributes.** Backticks only for interpolation and Lit templates.
- **Trailing commas everywhere.** One-line diffs when appending.
- **LF line endings**, enforced by `.gitattributes`, since development happens on Windows and CI runs on Linux.

Blank lines: one between logical blocks inside a function, one between top-level declarations, two never. No blank line immediately after `{` or before `}`.

Run Prettier on save. Nobody argues about formatting in review.

---

## 3. Conditionals

A conditional that fits on one line stays on one line:

```js
if (!room) return null;
```

Once it exceeds `printWidth`, or once it has three or more operands, it splits. **One condition per line, boolean operator leading**, so the operators form a readable column and adding a condition is a one-line diff:

```js
// Good
if (
    player.connected
    && player.id !== room.hostId
    && Date.now() - player.joinedAt > GRACE_PERIOD_MS
) {
    dropPlayer(room, player.id);
}

// Bad — trailing operators, hard to scan, noisy diffs
if (player.connected &&
    player.id !== room.hostId &&
    Date.now() - player.joinedAt > GRACE_PERIOD_MS) {
```

Do not mix `&&` and `||` at the same level without parentheses. If a condition needs a comment to be understandable, extract it into a named boolean or a small predicate function instead:

```js
const isAbandonedRoom = room.connectedCount === 0 && idleMs > ROOM_IDLE_LIMIT_MS;
```

**Braces always**, even for single statements — with the one exception of a guard clause that fits entirely on one line, as above. Prefer early returns over nesting; three levels of indentation inside a function is a signal to extract.

Ternaries are fine when they fit on one line and produce a value. Never nest them; use `if`/`else` or a lookup table.

---

## 4. Comments and JSDoc

### Every function gets a comment

No exceptions, including small helpers and non-exported ones. A one-line `//` comment above the declaration is enough when the function is internal and obvious:

```js
// Converts a flat cell index into { row, col } for the given puzzle size.
function toCoords(idx, size) {
    return { row: Math.floor(idx / size.cols), col: idx % size.cols };
}
```

Comments describe **what the function does and why it exists**, not how it does it. If the comment restates the body line by line, delete the comment and rename the function.

### Public class interfaces get full JSDoc

Any method that callers outside the class use — plus every exported function — carries a JSDoc block with the complete interface. This is what makes `checkJs` earn its keep per [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md), and it's the closest thing this codebase has to a signature:

```js
/**
 * Applies an op to the board, resolving conflicts by per-cell last-writer-wins.
 *
 * @param {BoardState} board - Current board; not mutated.
 * @param {Op} op - The op to apply, already schema-validated.
 * @param {number} seq - Server-assigned sequence number for this op.
 * @returns {BoardState} A new board state with the op applied.
 * @throws {RangeError} If `op.cell` is outside the puzzle's bounds.
 */
applyOp(board, op, seq) { … }
```

Rules for the blocks:

- Order tags `@param` → `@returns` → `@throws` → `@fires` → `@see`.
- Types come from the `@typedef`s in `shared/protocol.js`. Define a shape once; never re-describe it inline.
- Describe every parameter. `@param {string} code` with no description is worse than none — it looks complete.
- Omit `@returns` only for genuinely void functions.
- Private methods (`#name`) need the comment from above, not the full block, unless the signature is non-obvious.

### Classes get a role comment

Above every class, a block saying what the class is responsible for and — where it matters — what it deliberately isn't:

```js
/**
 * Single source of truth for room, board, and presence state on the client.
 *
 * Owns the socket; components never touch one directly. Holds optimistic
 * `pendingOps` and renders `serverState + pendingOps`. Does not own routing
 * or rendering — see `<pt-app>` for those.
 */
export class RoomStore { … }
```

### Everything else

- `// TODO:` and `// FIXME:` must name the phase or issue that resolves them (`// TODO(phase-3): …`). An untagged TODO is a comment nobody will ever act on.
- Explain **why**, not what, in inline comments. The non-obvious constraint, the bug being avoided, the spec section being satisfied.
- No commented-out code. Git remembers it.
- No decorative banner comments (`// ===== HELPERS =====`). If a file needs sections, it needs splitting.

---

## 5. Naming

| Thing | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase` | `elapsedMs`, `assignColor` |
| Classes, typedefs | `PascalCase` | `RoomStore`, `BoardState` |
| Module constants | `SCREAMING_SNAKE` | `GRACE_PERIOD_MS`, `PROTOCOL_VERSION` |
| Private class members | `#` prefix | `#socket`, `#flushPending()` |
| Files and directories | `kebab-case.js` | `board-reducer.js`, `store-controller.js` |
| Custom elements | `pt-` prefix, one per file, file matches tag | `pt-sudoku-board.js` → `<pt-sudoku-board>` |
| Custom events | `pt-` prefix, kebab | `pt-cell-input` |
| CSS custom properties | `--kebab-case` | `--ink`, `--accent`, `--pencil` |
| Socket events | `domain:action` | `game:op`, `room:backToSelect` |
| Booleans | `is` / `has` / `should` / `can` prefix | `isHost`, `hasPendingOps` |
| Event handlers | `on` prefix | `onCellFocus` |
| Test files | `<module>.test.js`, beside the module | `board-reducer.test.js` |

Durations carry their unit in the name — `graceMs`, `sweepIntervalMs`, `elapsedMs`. A bare `timeout` is a bug waiting to happen.

No abbreviations beyond the established vocabulary of the codebase (`idx`, `op`, `seq`, `rng`, `doc`, `cb`). Spell out everything else.

---

## 6. Modules and imports

ESM everywhere — `import`/`export`, no `require`, no CommonJS interop.

**Named exports by default.** Default exports are allowed in exactly two places, both because the design calls for them: `server/puzzles/<type>/index.js` (the module interface object from [design-spec.md §7](design-spec.md#7-the-puzzle-abstraction)) and Lit component files that export a single element class.

Import order, blank line between groups:

1. Node builtins, `node:` prefixed (`node:crypto`, `node:worker_threads`)
2. External packages
3. `shared/`
4. Local, relative

**Dependency direction is a hard rule.** `shared/` imports nothing from `client/` or `server/` — it is imported by both and must run in both. `client/` never imports from `server/`. A violation here is what makes `applyOp()` diverge between the two sides, which is the failure mode [design-spec.md §6](design-spec.md#6-the-shared-state-model-the-core-problem) exists to prevent. ESLint enforces it.

One file, one concern. A module past ~300 lines is asking to be split.

---

## 7. Functions and control flow

- **Small and single-purpose.** If you can't write the §4 comment in one sentence, the function does two things.
- **Three positional parameters maximum.** Past that, take an options object — `create({ difficulty, size, rng })`, not `create(difficulty, size, rng, retries)`.
- **`const` by default, `let` when reassigned, `var` never.**
- **No parameter mutation** and no mutation of arguments passed in. Reducers in `shared/` are pure: same inputs, same output, no I/O, no clock reads, no `Math.random()` — randomness comes from an injected seeded `rng`, which is what makes puzzles reproducible from a seed and generator tests deterministic.
- **`async`/`await` over `.then()` chains.** No floating promises — `await` it, return it, or explicitly `void` it with a comment saying why.
- Prefer `map`/`filter`/`reduce` for transformations; prefer a plain `for` loop in the per-cell hot paths (generators, solvers, board rendering), where allocation matters.
- Use `===`. The single permitted exception is `== null` to test null-or-undefined in one go.

---

## 8. Errors

- Client→server handlers reply with the structured ack from [design-spec.md §10](design-spec.md#10-socket-protocol): `cb({ ok: false, error: { code, message } })`. Error codes are `SCREAMING_SNAKE` constants in `shared/protocol.js`, never inline string literals.
- **Never throw across the socket boundary.** A handler that throws kills the connection; validate, then return an ack.
- Validation and authorization are separate steps and both happen server-side. Shape first (`shared/schema.js`), authority second (`playerId === room.hostId`).
- Never swallow an error. `catch` either handles it, wraps it with context and rethrows, or logs it — and an empty `catch {}` needs a comment justifying itself.
- Throwing is for programmer errors — bad arguments, impossible states — and those use the specific built-in (`TypeError`, `RangeError`), not bare `Error`.

---

## 9. Lit components and CSS

**Components**

- One component per file; the file name matches the tag.
- Reactive state goes in `static properties`. Anything not driving a render is a `#private` field, not a property.
- `render()` stays declarative and short. Logic belongs in methods above it or in the store — never in the template expression.
- Components read state through `StoreController` and emit intent as custom events. **No component holds a socket** and none reaches into another's internals or shadow DOM.
- Per [design-spec.md §11](design-spec.md#11-client-architecture), cell updates mutate `<pt-cell>` properties directly rather than re-rendering the grid. Anything in a render path that runs per cell is performance-sensitive — keep it allocation-free.

**CSS**

- **Tokens only.** No hard-coded color, font, radius, or spacing value in a component — every one comes from a custom property defined in `client/styles/tokens.css`. A literal hex in a component file is a review failure. This is what keeps the dark theme a token swap rather than an audit.
- Component styles live in a `static styles` block using Lit's `css` tag. Global styles are confined to `styles/base.css`.
- 4-space indent, one declaration per line, logical property order: layout → box → typography → visual → motion.
- Respect `prefers-reduced-motion` on anything that animates.

---

## 10. Enforcement

**Scope, decided in Phase 1**: ESLint and `tsc --noEmit` run over **`shared/` only** — the socket
contract, and the one place a silent mismatch desyncs the board rather than producing a visible
bug. `client/` and `server/` are formatted by Prettier and covered by tests; they are not linted or
type-checked. This narrows [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md)'s first mechanism
without changing its second.

| Rule | Where | How |
|---|---|---|
| Indentation, quotes, width, commas, semicolons | everywhere | Prettier — auto-fixed |
| `const`/`let`, `===`, unused vars | `shared/` | ESLint — errors |
| `shared/` dependency direction | `shared/` | ESLint `no-restricted-imports` — error |
| Type correctness of JSDoc | `shared/` | `npm run typecheck` (`tsc --noEmit`, `checkJs`) |
| Payload shapes at runtime | server boundary | `shared/schema.js`, covered by `schema.test.js` |
| Conditional splitting style | everywhere | Prettier does most of it; review catches the rest |
| **Function, class, and public-method comments** | everywhere | **Review** — a machine can require a JSDoc block's presence, not that it says anything true |
| No hard-coded design values in components | `client/` | Review, plus the contrast gate in `tokens.test.js` |

`npm run lint && npm run typecheck && npm test && npm run build` is what CI runs and what must pass before merge ([design-spec.md §12](design-spec.md#12-testing-tooling-ci)).

The comment rules are the ones a machine can't check and the ones that decay first — [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md) already flags un-annotated code silently becoming `any` as this stack's main risk. Treat a missing or stale comment as a blocking review comment, the same as a missing test.
