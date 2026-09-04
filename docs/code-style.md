# PuzzleTogether: Code Style

> Companion to [design-spec.md](design-spec.md) · [architecture.md](architecture.md) · [ADR-0003](adr/0003-lit-and-vanilla-js-over-typescript.md) · [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md)
>
> Enforced by `eslint.config.js` and `.prettierrc` where a machine can enforce it, by review where it cannot. The split is in §10.

No compile step means no type checker forcing consistency on the codebase; only JSDoc, ESLint, and this document. The conventions here are load-bearing, not cosmetic.

---

## 1. The four house rules

Everything below elaborates on these.

1. **Indentation is 4 spaces.** Never tabs, never 2, in any file type: JS, CSS, HTML, JSON, Markdown.
2. **Long conditionals split across lines**, one condition per line.
3. **Every function has a comment** saying what it does.
4. **Every class has a role comment**, and **every public method carries a full JSDoc block**: `@param`, `@returns`, `@throws` where they apply.

---

## 2. Formatting

`.prettierrc` is the source of truth.

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

- **100 columns**: wide enough for a JSDoc line or a Lit template, narrow enough for a side-by-side diff.
- **Semicolons always.** No ASI edge cases.
- **Single quotes in JS, double quotes in HTML attributes.** Backticks only for interpolation and Lit templates.
- **Trailing commas everywhere.** One-line diffs when appending.
- **LF line endings**, enforced by `.gitattributes`, since development happens on Windows and CI runs on Linux.

Blank lines: one between logical blocks inside a function, one between top-level declarations, never two. No blank line after `{` or before `}`.

Run Prettier on save.

---

## 3. Conditionals

A conditional that fits on one line stays on one line:

```js
if (!room) return null;
```

Past `printWidth`, or at three or more operands, it splits. **One condition per line, boolean operator leading**, so the operators form a column and adding a condition is a one-line diff:

```js
// Good
if (
    player.connected
    && player.id !== room.hostId
    && Date.now() - player.joinedAt > GRACE_PERIOD_MS
) {
    dropPlayer(room, player.id);
}

// Bad: trailing operators, hard to scan, noisy diffs
if (player.connected &&
    player.id !== room.hostId &&
    Date.now() - player.joinedAt > GRACE_PERIOD_MS) {
```

Do not mix `&&` and `||` at one level without parentheses. A condition that needs a comment becomes a named boolean or a predicate function:

```js
const isAbandonedRoom = room.connectedCount === 0 && idleMs > ROOM_IDLE_LIMIT_MS;
```

**Braces always**, except a guard clause that fits entirely on one line. Prefer early returns over nesting; three levels of indentation is a signal to extract.

Ternaries are fine when they fit on one line and produce a value. Never nest them.

---

## 4. Comments and JSDoc

### Every function gets a comment

No exceptions, including small helpers and non-exported ones. One `//` line is enough when the function is internal and obvious:

```js
// Converts a flat cell index into { row, col } for the given puzzle size.
function toCoords(idx, size) {
    return { row: Math.floor(idx / size.cols), col: idx % size.cols };
}
```

Comments say **what the function does and why it exists**, not how. If the comment restates the body, delete it and rename the function.

**Never put a backtick in a comment inside a template literal.** It ends the `css` or `html` template early; see §10. Refer to identifiers by bare name.

### Public class interfaces get full JSDoc

Any method callers outside the class use, plus every exported function:

```js
/**
 * Applies an op to the board, resolving conflicts by per-cell last-writer-wins.
 *
 * @param {BoardState} board - Current board; not mutated.
 * @param {Op} op - The op to apply, already schema-validated.
 * @param {number} seq - Server-assigned sequence number for this op.
 * @returns {BoardState} A new board state with the op applied.
 * @throws {RangeError} If op.cell is outside the puzzle's bounds.
 */
applyOp(board, op, seq) { … }
```

- Order tags `@param` → `@returns` → `@throws` → `@fires` → `@see`.
- Types come from the `@typedef`s in `shared/protocol.js`. Define a shape once.
- Describe every parameter. `@param {string} code` with no description looks complete and is not.
- Omit `@returns` only for void functions.
- Private methods (`#name`) need the comment, not the full block, unless the signature is non-obvious.

### Classes get a role comment

What the class is responsible for and, where it matters, what it deliberately is not:

```js
/**
 * Single source of truth for room, board, and presence state on the client.
 *
 * Owns the socket; components never touch one directly. Holds optimistic
 * pendingOps and renders serverState + pendingOps. Does not own routing
 * or rendering.
 */
export class RoomStore { … }
```

### Everything else

- `// TODO:` and `// FIXME:` name the phase or issue that resolves them (`// TODO(phase-5): …`). An untagged TODO is a comment nobody will act on.
- Explain **why**, not what: the non-obvious constraint, the bug being avoided, the spec section satisfied.
- No commented-out code. Git remembers it.
- No banner comments. A file that needs sections needs splitting.

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

Durations carry their unit: `graceMs`, `sweepIntervalMs`, `elapsedMs`. A bare `timeout` is a bug waiting to happen.

No abbreviations beyond the established vocabulary (`idx`, `op`, `seq`, `rng`, `doc`, `cb`).

---

## 6. Modules and imports

ESM everywhere. No `require`, no CommonJS interop.

**Named exports by default.** Default exports are allowed in two places: `server/puzzles/<type>/index.js` (the module interface object from [design-spec.md §7](design-spec.md#7-the-puzzle-abstraction)) and Lit component files exporting a single element class.

Import order, blank line between groups:

1. Node builtins, `node:` prefixed
2. External packages
3. `shared/`
4. Local, relative

**Dependency direction is a hard rule.** `shared/` imports nothing from `client/` or `server/`; it is imported by both and must run in both. `client/` never imports from `server/`. A violation is what makes `applyOp()` diverge between the two sides. ESLint enforces it.

One file, one concern. A module past ~300 lines is asking to be split.

---

## 7. Functions and control flow

- **Small and single-purpose.** If the §4 comment does not fit in one sentence, the function does two things.
- **Three positional parameters maximum.** Past that, take an options object.
- **`const` by default, `let` when reassigned, `var` never.**
- **No parameter mutation.** Reducers in `shared/` are pure: same inputs, same output, no I/O, no clock reads, no `Math.random()`. Randomness comes from an injected seeded `rng`, which is what makes puzzles reproducible and generator tests deterministic.
- **`async`/`await` over `.then()`.** No floating promises: await it, return it, or `void` it with a comment.
- Prefer `map`/`filter`/`reduce` for transformations; prefer a plain `for` loop in per-cell hot paths (generators, solvers, board rendering).
- Use `===`. The one exception is `== null`.

---

## 8. Errors

- Client→server handlers reply with the structured ack from [design-spec.md §10](design-spec.md#10-socket-protocol): `cb({ ok: false, error: { code, message } })`. Codes are `SCREAMING_SNAKE` constants in `shared/protocol.js`, never inline literals.
- **Never throw across the socket boundary.** A handler that throws kills the connection. Validate, then return an ack.
- Validation and authorization are separate steps, both server-side. Shape first (`shared/schema.js`), authority second (`playerId === room.hostId`).
- Never swallow an error. An empty `catch {}` needs a comment justifying itself.
- **Server code logs through `server/log.js`**, never `console.*` directly: an event name plus flat fields, `roomCode` and `playerId` where they apply, and a thrown value under `err` ([ADR-0026](adr/0026-one-log-line-per-event.md)). Nothing on the op or focus path logs at all.
- Throwing is for programmer errors, using the specific built-in (`TypeError`, `RangeError`), not bare `Error`.

---

## 9. Lit components and CSS

**Components**

- One component per file; the file name matches the tag.
- Reactive state goes in `static properties`. Anything not driving a render is a `#private` field.
- `render()` stays declarative and short. Logic belongs in methods above it or in the store.
- Components read state through `StoreController` and emit intent as custom events. **No component holds a socket** and none reaches into another's shadow DOM.
- Cell updates mutate `<pt-cell>` properties directly rather than re-rendering the grid. Anything in a per-cell render path is performance-sensitive: keep it allocation-free.

**CSS**

- **Tokens only.** No hard-coded color, font, radius, or spacing value in a component. A literal hex in a component file is a review failure. This is what keeps the dark theme a token swap rather than an audit.
- Component styles live in `static styles` using Lit's `css` tag. Global styles are confined to `styles/base.css`.
- **Set `box-sizing: border-box` in any shadow root whose layout depends on it.** The reset in `base.css` does not cross a shadow boundary. Two bugs came from this: chips overflowing their grid track, and cells whose `aspect-ratio` measured a content box a border had changed.
- **Anything shared between components is a `css` fragment in `styles/controls.js`**, composed into `static styles`. A shadow root inherits custom properties but not rules. Any component holding something focusable composes `focusRing` (or `controls`, which includes it); omitting it does not fail loudly, it grows a second focus colour.
- **Icons come from `ui/icons.js`**, are `aria-hidden`, and never carry meaning a label does not. Consumers compose `iconStyle`, except the panel's controls, which fix their icons at `1rem` so they match each other rather than their inherited font size.
- 4-space indent, one declaration per line, order layout → box → typography → visual → motion.
- Every hover rule sits behind `@media (hover: hover)`. A touch browser emulates hover on whatever was tapped last and holds it, so a hover style otherwise sticks to a tapped control indefinitely. `:active` is what answers a tap.
- Respect `prefers-reduced-motion` on anything that animates.

---

## 10. Enforcement

**ESLint and `tsc --noEmit` run over `shared/`, `tests/`, and `scripts/`, not over `client/` or `server/`.** One reason applied three times:

- `shared/` is the socket contract, the one place a silent mismatch desyncs the board rather than producing a visible bug.
- `tests/` is the one thing nothing else checks. It gets browser globals, since `page.evaluate()` callbacks run in the page.
- `scripts/` is the only code that writes content into the repo. `import-crossword.js` produces the bank files the server serves and is run by hand and rarely, which is where a typo waits months to be found. Node globals only.

`client/` and `server/` are formatted by Prettier and covered by tests.

**Prettier covers code, not prose** (`.prettierignore`). It reflows Markdown paragraphs and re-lays-out tables, which costs more in readability than it buys; `docs/` is read more often than it is diffed. §1's 4-space rule still applies to Markdown, enforced by review.

| Rule | Where | How |
|---|---|---|
| Indentation, quotes, width, commas, semicolons | JS, CSS, HTML, JSON | Prettier, auto-fixed |
| Indentation and layout in Markdown | `docs/`, `README.md` | Review; Prettier is off there |
| `const`/`let`, `===`, unused vars | `shared/`, `tests/`, `scripts/` | ESLint, errors |
| `shared/` dependency direction | `shared/` | ESLint `no-restricted-imports` |
| Type correctness of JSDoc | `shared/` | `npm run typecheck` (`tsc --noEmit`, `checkJs`) |
| Payload shapes at runtime | server boundary | `shared/schema.js`, covered by `schema.test.js` |
| Conditional splitting style | everywhere | Prettier does most; review catches the rest |
| **Function, class, and public-method comments** | everywhere | **Review.** A machine can require a block's presence, not that it says anything true |
| No hard-coded design values in components | `client/` | Review, plus the contrast gate in `tokens.test.js` |
| **No backtick inside a CSS comment** | `client/` | **`css-templates.test.js`** |

CI runs `npm ci && npm run lint && npm run typecheck && npm test && npm run test:ui && npm run build` ([design-spec.md §12](design-spec.md#12-testing-tooling-ci)).

**The backtick check earned its place.** A backtick in a comment inside a `css` template ends the template, and it cost the build eight times across four phases. Once it did not cost the build: the truncated remainder parsed as valid JavaScript, `npm run build` succeeded, and every browser test failed at once on an error pointing nowhere near the CSS. **The build is not the check.** `css-templates.test.js` walks each `css` template to the backtick that closes it and fails if that backtick is inside a comment.

The comment rules are the ones a machine cannot check and the ones that decay first; [ADR-0006](adr/0006-jsdoc-checkjs-for-type-safety.md) flags unannotated code silently becoming `any` as this stack's main risk. Treat a missing or stale comment as a blocking review comment.

---

## 11. Design decisions

| Decision | Original design | Why it changed | When |
|---|---|---|---|
| ESLint and typecheck cover `shared/` only | Repo-wide static checking | `checkJs` over application code produced noise about DOM narrowing and Lit base-class typings: cost without the matching risk. The desync risk is confined to the contract | Phase 1, 2026-08-02 |
| `tests/` is linted too | `shared/` only | Everything else in the repo is checked by a test; the tests are what nothing else checks | Phase 2 |
| `scripts/` is linted too | `shared/` and `tests/` | It is the only code that writes content into the repo, run by hand and rarely | Phase 4, 2026-08-05 |
| Prettier ignores Markdown | Prettier ran repo-wide | It reflowed prose and re-laid-out tables; readability cost exceeded the consistency gain | Phase 2 |
| The backtick trap is a unit test | A manual `node -e "import(…)"` check per changed component, then a scratchpad scanner | The manual check depends on remembering it, and the build does not always catch the trap | Phase 4b, 2026-08-09 |
