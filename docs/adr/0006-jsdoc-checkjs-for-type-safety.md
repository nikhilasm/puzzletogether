# ADR-0006 — JSDoc plus `checkJs` for type safety, and runtime validation at the boundary

- **Status**: Accepted · **amended 2026-08-02 (Phase 1)** — see "Amendment: scope" below
- **Date**: 2026-08-02
- **Context**: [design-spec.md §10](../design-spec.md#10-socket-protocol) · [ADR-0003](0003-lit-and-vanilla-js-over-typescript.md)

## Context

Client and server exchange around two dozen socket event payloads, and both import the same `shared/` modules — most importantly `board-reducer.js`, whose `applyOp()` must behave identically on both sides or the board silently desyncs.

That is exactly the situation where static types earn their keep. But [ADR-0003](0003-lit-and-vanilla-js-over-typescript.md) commits to vanilla JavaScript, so the question is how much of the benefit can be had without adopting TypeScript.

There is also a separate problem that types do not solve at all: **a compiler cannot check what arrives over a socket.** Payloads come from a browser the server does not control, and the prototype trusted every one of them — including a client-supplied `isHost` boolean.

## Decision

**Two mechanisms, addressing two different problems.**

**1. Editor-time: JSDoc typedefs plus `jsconfig.json` with `checkJs: true`.**

- `shared/protocol.js` holds event-name constants, `PROTOCOL_VERSION`, and a `@typedef` for every payload shape.
- Type annotations go in JSDoc comments across client, server, and shared code.
- `checkJs` makes the TypeScript language service check plain `.js` files, giving real errors, autocomplete, and go-to-definition with no compile step and no `.ts` files.
- `npm run typecheck` runs `tsc --noEmit` in CI, so type errors fail the build.

**2. Runtime: `shared/schema.js` validates every inbound payload at the server boundary.**

- A small declarative validator — roughly 120 lines, no dependency — describing each payload's expected shape.
- Every client-to-server handler validates before touching room state. Invalid payloads get a structured error ack; they never reach a handler.
- Authorization is separate from validation and always server-side: a well-formed `game:reveal` from a non-host is rejected on authority, not shape.
- `PROTOCOL_VERSION` travels in the handshake; a major mismatch returns "please refresh" instead of failing mysteriously after a deploy.

## Amendment: scope (Phase 1)

Mechanism 1 applies to **`shared/` only**. `npm run typecheck` and ESLint both run over the socket
contract — `protocol.js`, `schema.js`, `board-reducer.js`, `constants.js`, `puzzle-doc.js` — and not
over `client/` or `server/`.

The reasoning is that this ADR's own argument is strongest exactly there and weakest elsewhere.
What static checking buys is catching a renamed field or a changed shape *across the client/server
boundary*, where the failure is a silent desync rather than a visible error. Inside application
code, `checkJs` mostly produced noise about DOM narrowing and Lit's base-class typings — cost
without the corresponding risk.

Mechanism 2 is unaffected and does the load-bearing work: every inbound payload is still validated
at the server boundary, which is what protects against hostile or stale clients. The "unannotated
code silently becomes `any`" risk below now applies to `client/` and `server/` in full, and review
is the only thing standing against it there.

## Consequences

**Good**

- Most of TypeScript's practical value — catching a renamed field or a wrong argument across the client/server boundary — with no build step, no second file extension, and no `.d.ts` files.
- Types live next to the code they describe, and a `@typedef` in `shared/protocol.js` is the single source of truth for both sides of a payload.
- Runtime validation covers what static types structurally cannot: hostile or stale clients. This closes the prototype's "trust the client" hole directly.
- Reversible in both directions. Renaming `.js` to `.ts` later is mechanical, and JSDoc types are already TypeScript's own syntax.

**Bad**

- **JSDoc is verbose.** A type that is one line in TypeScript can be five in a comment block. Complex generics are painful and sometimes not worth expressing.
- **Nothing enforces annotation coverage.** Unannotated code silently becomes `any`, and `checkJs` will not complain. This degrades quietly if reviews let it.
- Two places describe the same shape — the `@typedef` and the runtime schema — which can drift. Mitigated by keeping both in `shared/` next to each other and treating a mismatch as a review failure.
- Runtime validation costs a small amount of work per message. Irrelevant at this scale, and worth it regardless.

## Alternatives rejected

**Adopt TypeScript.** The strongest alternative, and the one that would make protocol drift a compile error. Rejected per [ADR-0003](0003-lit-and-vanilla-js-over-typescript.md) — and notably, it would *not* remove the need for runtime validation, since a compiler cannot check a socket payload. So TypeScript replaces mechanism 1 and leaves mechanism 2 untouched.

**Zod or a similar schema library, deriving types from schemas.** Genuinely elegant: one definition produces both the validator and the type, eliminating the drift problem above. Rejected for now because inferred types are far weaker without TypeScript, so most of the benefit evaporates in a JSDoc world — leaving a runtime dependency doing work that ~120 lines already does. **This is the most likely of these to be revisited**, and it becomes clearly correct if TypeScript is ever adopted.

**Types only, no runtime validation.** Fastest to write and unsafe. Static types describe what *should* arrive, not what does. This is how the prototype ended up trusting a client-supplied `isHost`.

**Runtime validation only, no static types.** Covers the security hole but gives no help while writing code, and would leave `applyOp()` — the one function that must agree across the boundary — entirely unchecked.
