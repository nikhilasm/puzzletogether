# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Writing style

Applies to everything: chat responses, prose in `docs/`, code, comments, JSDoc, commit messages, PR bodies.

- **Be as concise as possible.** Direct language, no flashy wording. Convey the needed information and nothing more. No preamble, no restating the request, no summary of work already visible in the diff.
- **Never use an em-dash character.** Not in prose, not in comments, not in docs. Split the sentence, or join the thoughts with a semicolon or colon.
- **Never use backticks in a code comment.** This is a build breaker inside Lit `css` and `html` template strings; see Known traps below. Refer to identifiers in comments by bare name.
- Concise code too: no defensive scaffolding nobody asked for, no options object for one caller, no abstraction ahead of its second use.

Existing prose in `docs/` predates these rules and uses em-dashes throughout. Leave it alone unless you are editing that passage anyway.

## Project

PuzzleTogether: a real-time multiplayer puzzle grid. One Node process, Express plus Socket.IO, vanilla JS with Lit on the client, JSDoc plus `checkJs` instead of TypeScript.

`shared/` is imported by both client and server and must run in both. It imports from neither. Breaking that is what makes `applyOp()` diverge between the two sides and desync the board.

## Before you edit

State intent in one line before making a change, then make it.

| Doing | Read first |
|---|---|
| Anything | [docs/code-style.md](docs/code-style.md) |
| Changing behaviour or structure | [docs/architecture.md](docs/architecture.md), [docs/design-spec.md](docs/design-spec.md) |
| Anything visual | [docs/brand.md](docs/brand.md), `client/styles/tokens.css` |
| Understanding why something is the way it is | [docs/adr/](docs/adr/) |

Do not restate those documents here. Extend them where they live.

**Ask rather than assume.** If the request is ambiguous, if two readings would produce different work, or if the qualification gate is missing, ask before writing code.

## Qualification gates

Every code change carries a gate: **minimal**, **partial**, or **full**. Each includes the one before it. **If the request does not name a gate, ask for it before starting.**

**minimal**: formatting and syntax only.
```
npm run format
npm run lint
```

**partial**: minimal, plus types and unit tests.
```
npm run typecheck
npm test
```

**full**: partial, plus the build and the browser suite.
```
npm run build
npm run test:ui
```

Report the gate you ran and its result. If something fails, say so and paste the output; do not report done on a red gate.

Other commands: `npm run dev` (server 3001, Vite client 5173), `npm run test:ui:chromium` (faster browser pass, but see the Firefox trap below).

## Documentation

Scale of the change decides the documentation burden.

- **Small** (a fix, a local refactor, a tweak inside one component): no docs.
- **Medium or larger** (new behaviour, a changed contract, anything crossing a module boundary): check `docs/` for statements the change makes untrue, and update them in the same commit. `architecture.md` Mermaid diagrams count.
- **A decision with a rejected alternative** (a new dependency, a changed abstraction, a constraint future work must respect): write an ADR in `docs/adr/`, numbered next in sequence, following the existing format.

## Do not touch

Generated output. Regenerate it, do not edit it.

- `client/dist/` (Vite build)
- `data/crosswords/` (written by `scripts/import-crossword.js`)
- `test-results/` (Playwright)
- `package-lock.json` other than as a side effect of an approved dependency change

Do not add dependencies without asking. Do not commit or push unless asked.

## Working rules

- Match the surrounding code. Formatting comes from `.prettierrc`: 4 spaces, single quotes, semicolons, 100 columns, trailing commas, LF.
- Every function gets a comment, every class a role comment, every public method a full JSDoc block. Review-blocking, not a preference.
- Tokens only in components. A literal hex, font, radius, or spacing value in a component file is a defect.
- Long conditionals split one per line with the boolean operator leading.
- Named exports by default; `const` by default; `===` always, except `== null`.

## Known traps

Each of these has already cost this project time. They are recorded across `docs/`; collected here so they are in view every session.

1. **A backtick inside a CSS comment ends the `css` template.** Seven occurrences, and once the truncated remainder parsed as valid JavaScript, so the build passed and every browser test failed at once on an error pointing nowhere near the CSS. **The build is not the check**; `client/css-templates.test.js` is. Never put a backtick in a comment inside a template literal.
2. **The `base.css` reset does not cross a shadow boundary.** Set `box-sizing: border-box` explicitly in any shadow root whose layout depends on it. Two bugs came from missing it: chips overflowing their grid track, and cells whose `aspect-ratio` measured a content box a border had changed.
3. **A shadow root inherits custom properties but not rules.** Anything shared lives as a `css` fragment in `client/styles/controls.js` and must be composed in. A component holding something focusable that omits `focusRing` does not fail loudly; the app just grows a second focus colour.
4. **A store slice nothing selects does not exist.** `StoreController` re-renders only on its host's selected slices. State added to `RoomStore` without being added to the selector makes the screen lag one interaction behind, which looks like an unrelated bug.
5. **`display: contents` on a wrapper component is load-bearing and quiet.** Forget it and the wrapper becomes one flex item holding several buttons; the row goes uneven rather than visibly broken.
6. **The pinned panel's height is reserved in `pt-app`, not `pt-game`.** The page ends with the footer, not the game screen. Reserved in the wrong place, the theme switch sits under the keys and cannot be clicked at any scroll position.
7. **Never throw across the socket boundary.** A handler that throws kills the connection. Validate, then return `cb({ ok: false, error: { code, message } })` with a code constant from `shared/protocol.js`.
8. **Unannotated code silently becomes `any`.** `checkJs` will not complain, so missing JSDoc degrades type safety without any signal. This is the stack's main stated risk.
9. **`schema.js` no longer bounds cell value length** (rebus widened it to 8). Each puzzle type's `validateOp` is the only thing holding the limit. A new type that forgets gets a bug, not an error.
10. **Grid alignment differs between engines.** The one cell-alignment bug that reached a user was Firefox-only; Chromium had rounded it away. A Chromium-only pass is not a full gate.
