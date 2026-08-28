# ADR-0006: JSDoc plus `checkJs` for type safety, and runtime validation at the boundary

- **Status**: Accepted, amended 2026-08-02 (Phase 1)
- **Date**: 2026-08-02
- **Context**: [design-spec.md §10](../design-spec.md#10-socket-protocol) · [ADR-0003](0003-lit-and-vanilla-js-over-typescript.md)

## Context

Client and server exchange around two dozen socket payloads and both import the same `shared/` modules, most importantly `board-reducer.js`, whose `applyOp()` must behave identically on both sides or the board silently desyncs. That is exactly where static types earn their keep, and [ADR-0003](0003-lit-and-vanilla-js-over-typescript.md) commits to vanilla JavaScript.

There is a separate problem types do not solve at all: **a compiler cannot check what arrives over a socket.** Payloads come from a browser the server does not control, and the prototype trusted every one of them, including a client-supplied `isHost`.

## Decision

**Two mechanisms for two different problems.**

**1. Editor-time: JSDoc typedefs plus `jsconfig.json` with `checkJs: true`.**

- `shared/protocol.js` holds event constants, `PROTOCOL_VERSION`, and a `@typedef` per payload shape.
- `checkJs` makes the TypeScript language service check plain `.js` files, giving real errors, autocomplete, and go-to-definition with no compile step.
- `npm run typecheck` runs `tsc --noEmit` in CI.
- **Scope: `shared/` only.** This ADR's argument is strongest there and weakest elsewhere. What static checking buys is catching a renamed field or a changed shape across the client/server boundary, where the failure is a silent desync rather than a visible error. Inside application code `checkJs` mostly produced noise about DOM narrowing and Lit base-class typings: cost without the matching risk.

**2. Runtime: `shared/schema.js` validates every inbound payload at the server boundary.**

- A declarative validator, roughly 120 lines, no dependency.
- Every client-to-server handler validates before touching room state. Invalid payloads get a structured error ack and never reach a handler.
- Authorization is separate and always server-side: a well-formed `game:reveal` from a non-host is rejected on authority, not shape.
- `PROTOCOL_VERSION` travels in the handshake; a major mismatch returns "please refresh".

Mechanism 2 is unscoped and does the load-bearing work.

## Consequences

**Good**

- Most of TypeScript's practical value across the contract, with no build step, no second file extension, and no `.d.ts` files.
- Types live next to the code they describe, and a `@typedef` in `shared/protocol.js` is the single source of truth for both sides of a payload.
- Runtime validation covers what static types structurally cannot: hostile or stale clients. This closes the prototype's trust-the-client hole directly.
- Reversible in both directions. Renaming `.js` to `.ts` later is mechanical, and JSDoc types are already TypeScript's syntax.

**Bad**

- **JSDoc is verbose.** A one-line TypeScript type can be five lines of comment, and complex generics are sometimes not worth expressing.
- **Nothing enforces annotation coverage.** Unannotated code silently becomes `any` and `checkJs` will not complain. With mechanism 1 scoped to `shared/`, this now applies to `client/` and `server/` in full, and review is the only thing standing against it. This is the stack's main stated risk.
- Two places describe the same shape, the `@typedef` and the runtime schema, and they can drift. Mitigated by keeping both in `shared/` and treating a mismatch as a review failure.
- Runtime validation costs a small amount of work per message. Irrelevant at this scale.

## Alternatives rejected

**Adopt TypeScript.** The strongest alternative, and the one that would make protocol drift a compile error. Rejected per [ADR-0003](0003-lit-and-vanilla-js-over-typescript.md), and it would not remove the need for runtime validation, so it replaces mechanism 1 and leaves mechanism 2 untouched.

**Zod or a similar schema library, deriving types from schemas.** Elegant: one definition produces both the validator and the type, eliminating the drift above. Rejected because inferred types are far weaker without TypeScript, leaving a runtime dependency doing work that ~120 lines already does. **The most likely of these to be revisited**, and clearly correct if TypeScript is ever adopted.

**Types only, no runtime validation.** Static types describe what *should* arrive, not what does. This is how the prototype ended up trusting a client-supplied `isHost`.

**Runtime validation only, no static types.** Covers the security hole, gives no help while writing code, and would leave `applyOp()` entirely unchecked.

## Revisions

| Change | Original | Why | When |
|---|---|---|---|
| Mechanism 1 covers `shared/` only | Type checking and linting across the whole repo | `checkJs` over application code produced noise about DOM narrowing and Lit typings without the desync risk that justifies it | Phase 1, 2026-08-02 |
| ESLint also covers `tests/` and `scripts/` | `shared/` only | The tests are what nothing else checks; `scripts/` is the only code that writes content into the repo | Phase 2 and Phase 4, 2026-08-05 |
