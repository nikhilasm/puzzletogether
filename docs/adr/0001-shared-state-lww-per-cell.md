# ADR-0001: Per-cell last-writer-wins for shared board state

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §6](../design-spec.md#6-the-shared-state-model-the-core-problem) · [architecture.md §3](../architecture.md#3-op-lifecycle)

## Context

Several people edit one shared puzzle grid simultaneously, which raises the question every collaborative editor has to answer: what happens when two people change the same thing at the same time?

The collaborative-editing literature is dominated by text, and text is hard because it has *ordering*. Insert a character at position 5 while someone deletes position 3 and the index is wrong; resolving that is what CRDTs and Operational Transformation exist to do.

A puzzle grid has none of that structure. Cell 42 is cell 42 forever. No insertions, no reindexing, no merge of concurrent edits into a combined value. Each cell is an independent register holding one value plus a set of pencil marks.

## Decision

**Server-authoritative, per-cell last-writer-wins, ordered by a monotonic room-level `seq`.**

- Clients emit ops (`set`, `marks`, `clear`, `fill`) with a client-generated `opId`.
- The server validates, assigns the next `seq`, writes the cell, and rebroadcasts to everyone including the sender.
- The last op the server processes for a cell is that cell's value. That is the entire conflict-resolution rule.
- Clients apply their own ops optimistically and render `serverState + pendingOps`, dropping each pending op when its echo arrives.
- A client that detects a `seq` gap sends `sync:request` and receives a full snapshot. The server keeps no op history to replay.
- `shared/board-reducer.js` implements `applyOp()` and is imported by both sides so the two cannot drift.

## Consequences

**Good**

- The conflict rule fits in one sentence and matches what users expect from shared spreadsheets.
- No history, no vector clocks, no tombstones, no metadata to garbage-collect. Board state is a flat map from cell index to value.
- Snapshot recovery removes a class of bugs: no op buffer to get out of sync, no "what if the client missed 400 ops" path.
- A single Node process assigns `seq`, so ordering is trivially correct with no locking.
- The load-bearing invariant, "applying ops sequentially equals the snapshot", is a straightforward property test.

**Bad**

- Genuinely concurrent edits to one cell mean one player's input vanishes. Presence makes this visible beforehand, but it will happen.
- No offline editing. A disconnected client takes a snapshot and discards pending work. Acceptable because the product is inherently synchronous.
- `seq` assignment depends on single-process serialization, one of the things that makes multi-instance deployment a real project ([ADR-0002](0002-in-memory-rooms-no-database.md)).

**The reserved mitigation is not needed.** A short soft-lock on focused cells was designed as the smallest fix if cell-fighting proved annoying. The 2026-08-05 playtest found LWW reads as logical rather than as losing work, so the soft-lock stays unbuilt by evidence rather than by deferral.

## Alternatives rejected

**CRDT (Yjs, Automerge).** Solves a problem this domain does not have. Buys offline editing and peer-to-peer merge at the cost of a large dependency, per-cell metadata that outlives the values, and a much harder debugging story.

**Operational Transformation.** Same objection, plus OT is easy to get subtly wrong and would need transform functions for op pairs that can never meaningfully conflict.

**Op-log with replay on reconnect.** Considered seriously. Rejected because it requires bounded history retention, a decision about a client falling off the end of the log, and a replay path exercised rarely and therefore permanently broken. A snapshot is a few KB and always correct.

**Client-authoritative with server relay.** Simplest to build and impossible to secure. The server must hold the solution and verify completion, so it owns board state anyway.
