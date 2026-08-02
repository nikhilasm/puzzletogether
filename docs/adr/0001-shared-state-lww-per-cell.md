# ADR-0001 — Per-cell last-writer-wins for shared board state

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §6](../design-spec.md#6-the-shared-state-model-the-core-problem) · [architecture.md §3](../architecture.md#3-op-lifecycle)

## Context

PuzzleTogether's defining feature is that several people edit **one shared puzzle grid** simultaneously. That immediately raises the question every collaborative editor has to answer: what happens when two people change the same thing at the same time?

The collaborative-editing literature is dominated by text. Text is hard because it has *ordering* — if I insert a character at position 5 while you delete position 3, my index is now wrong, and resolving that correctly is what CRDTs and Operational Transformation exist to do.

A puzzle grid has none of that structure. Cell 42 is cell 42 forever. There are no insertions, no deletions, no reindexing, no merge of concurrent edits into a combined value. Each cell is an independent register holding one value plus a set of pencil marks.

## Decision

**Server-authoritative, per-cell last-writer-wins, ordered by a monotonic room-level `seq`.**

- Clients emit ops (`set`, `marks`, `clear`, `fill`) with a client-generated `opId`.
- The server validates, assigns the next `seq`, writes the cell, and rebroadcasts the op to everyone including the sender.
- The last op the server processes for a cell is that cell's value. That is the entire conflict-resolution rule.
- Clients apply their own ops optimistically and render `serverState + pendingOps`, dropping each pending op when its echo arrives.
- A client that detects a `seq` gap requests `sync:request` and receives a full snapshot. The server keeps no op history to replay.
- `shared/board-reducer.js` implements `applyOp()` and is imported by both client and server so the two cannot drift.

## Consequences

**Good**

- The conflict rule fits in one sentence and matches what users already expect from shared spreadsheets.
- No history, no vector clocks, no tombstones, no garbage collection of metadata. Board state is a flat map from cell index to value.
- Snapshot-based recovery removes a whole class of bugs — there is no op buffer to get out of sync, and no "what if the client missed 400 ops" path.
- Because a single Node process assigns `seq`, ordering is trivially correct with no locking.
- Testable: the load-bearing invariant is "applying ops sequentially equals the snapshot," which is a straightforward property test.

**Bad**

- Genuinely concurrent edits to one cell mean one player's input silently vanishes. Presence dots make this visible beforehand, but it will happen.
- No offline editing. A disconnected client's queued ops are not merged on reconnect — it takes a snapshot and discards pending work. Acceptable because the product is inherently synchronous and social.
- `seq` assignment depends on single-process serialization, which is one of the things that makes multi-instance deployment a real project rather than a config change ([ADR-0002](0002-in-memory-rooms-no-database.md)).

**Mitigation if it goes wrong**

If playtesting shows cell-fighting is actually annoying, the smallest fix is a short soft-lock on focused cells — reject ops to a cell another player has focused within the last ~2 seconds. This is additive and needs no change to the state model. Deliberately not built now, because a hard lock in a five-person room is likely worse than the problem.

## Alternatives rejected

**CRDT (Yjs, Automerge).** Solves a problem this domain does not have. Buys offline editing and peer-to-peer merge at the cost of a large dependency, per-cell metadata that outlives the values, and a much harder debugging story. The grid has no ordering to converge on.

**Operational Transformation.** Same objection, plus OT is notoriously easy to get subtly wrong and would need transform functions for op pairs that can never meaningfully conflict.

**Op-log with replay on reconnect.** Considered seriously. Rejected because it requires bounded history retention, a decision about what happens when a client falls off the end of the log, and a replay path that is exercised rarely and therefore stays broken. A snapshot is a few KB and always correct.

**Client-authoritative with server relay.** Simplest to build and impossible to secure. The server must hold the solution and verify completion, so it must own board state anyway.
