# ADR-0003 — Lit web components and vanilla JavaScript

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §11](../design-spec.md#11-client-architecture) · [architecture.md §6](../architecture.md#6-client-structure)

## Context

The prototype's client was 138 lines of jQuery swapping HTML templates into a div, wired together with inline `onclick` handlers reaching for a global object. That does not survive contact with four puzzle types, real-time sync, per-player presence, keyboard navigation, and an on-screen keypad.

The rebuild needs a component model, a build step, and a way to keep a grid of several hundred cells updating efficiently. The open question was which framework, and whether to adopt TypeScript alongside it.

## Decision

**Vite + Lit web components + vanilla JavaScript. No TypeScript.**

- Lit for all UI, with a `<pt-board>` base element and one subclass per puzzle type.
- A single `RoomStore` observable class owning the socket; components subscribe via a Lit `ReactiveController`.
- Vite for dev server, HMR, and production bundling.
- Type safety comes from JSDoc plus `checkJs`, which is its own decision ([ADR-0006](0006-jsdoc-checkjs-for-type-safety.md)).

## Consequences

**Good**

- Lit is small (~5KB) and close to the platform. Components are real custom elements, and the base-plus-subclass shape maps directly onto "every puzzle is a grid, but each renders cells differently."
- Scoped styles per component come free via shadow DOM, which suits a design system built on custom properties ([brand.md](../brand.md)).
- Lit's reactive properties allow updating one `<pt-cell>` without re-rendering the grid — the specific performance property this app needs.
- No JSX, no compiler magic, no framework-specific routing or state library to learn. The output is close to what was written.
- Skipping TypeScript keeps the build simple and matches the existing codebase's idiom, with no `.d.ts` juggling for a project whose main types are a handful of plain object shapes.

**Bad**

- Lit has a smaller ecosystem than React. Anything off the shelf — a date picker, a modal library — likely does not exist, so it gets hand-built. For this app's surface area that is a small cost, and hand-building suits a design that rejects generic component styling anyway.
- Shadow DOM makes global styling and some accessibility patterns fiddlier; `aria` relationships across shadow boundaries need care, which matters for `role="grid"`.
- Without TypeScript, refactoring across the client/server boundary has no compiler backstop. [ADR-0006](0006-jsdoc-checkjs-for-type-safety.md) exists specifically to blunt this.
- Fewer developers know Lit than React, so onboarding is slower.

**Watch for**

Per-cell update performance is the main unknown. If `repeat()` plus reactive properties can't keep a 25×25 grid smooth, the fallback is direct DOM manipulation inside a single board element — keeping Lit for everything else. Phase 1 tests this on a 25×25 grid deliberately, before nonogram actually needs it in Phase 3.

## Alternatives rejected

**React.** The default answer, and defensible. Rejected because it brings a larger runtime and a build/ecosystem footprint for a UI that is one grid, some chips, and two modals — and because per-cell update control is more direct in Lit than fighting reconciliation and memoization for the same result.

**Svelte.** Genuinely appealing: small output, great ergonomics, excellent fine-grained updates. Rejected mainly because it is a compiler with its own language, which is a bigger conceptual jump from the existing vanilla-JS codebase than Lit's "classes that render templates."

**No framework, plain DOM.** Considered, since the app is small. Rejected because four puzzle types plus presence, keypad, modals, and routing is exactly the amount of state where hand-rolled DOM turns into an ad-hoc framework — which is how the prototype's client became unmaintainable.

**TypeScript with any of the above.** The real benefit would be typing the socket protocol shared between client and server. [ADR-0006](0006-jsdoc-checkjs-for-type-safety.md) captures that benefit through JSDoc and `checkJs` without adding a compile step or a second file extension.
