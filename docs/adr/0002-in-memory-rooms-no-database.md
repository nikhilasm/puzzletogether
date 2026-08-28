# ADR-0002: In-memory rooms, no database

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §9](../design-spec.md#9-rooms-identity-lifecycle) · [architecture.md §7](../architecture.md#7-what-would-change-for-multiple-instances)

## Context

A room holds its roster, host, settings, puzzle document, solution, board state, streak, and timers. The prototype used a plain `const ROOMS = {}` that worked and never cleaned up after itself.

Everything a room contains is **ephemeral by nature**: a room exists because five people are solving a puzzle right now and has no meaning an hour later. There are no accounts, no saved progress, no cross-session history in scope.

## Decision

**Rooms live in a process-local `Map`, with a real lifecycle and garbage collection. No database, no Redis, no disk persistence for room state.**

- `rooms/store.js` owns the map; nothing else touches it directly.
- Every room carries `createdAt`, `lastActivityAt`, and a `timers: Set` so nothing leaks.
- A 60-second sweep deletes rooms with zero connected players for >10 minutes, or total age >12 hours, clearing all timers first.
- The only durable data on disk is the crossword bank, which is content, not state ([ADR-0004](0004-hybrid-puzzle-supply.md)).

## Consequences

**Good**

- Zero infrastructure. `npm start` is the deployment story; a Dockerfile and a `PORT` are enough to ship.
- Every room mutation is synchronous, which is what makes `seq` assignment and LWW resolution trivially correct ([ADR-0001](0001-shared-state-lww-per-cell.md)).
- Nothing to migrate, back up, or schema-version while the product changes shape weekly.
- No user data at rest means no data-retention or privacy surface.

**Bad**

- **A deploy or crash destroys every in-progress room**, dropping users mid-puzzle with no recovery.
- The solve streak dies with the room, so it can never become a longer-term hook without revisiting this.
- Exactly one instance can serve the app.
- Memory is unbounded in principle. GC plus a room cap is the only defence.

**What multi-instance would require**, recorded so the constraint is visible: `@socket.io/redis-adapter` for cross-instance broadcast; room state in Redis, making every mutation async and forcing a concurrency story for `seq`; sticky sessions or enough state in Redis that any instance can serve any socket; and a puzzle pool that becomes per-instance waste or moves behind a shared queue. That is a real project, and deferring it is the point of this decision.

## Alternatives rejected

**SQLite or Postgres for rooms.** Adds a schema, migrations, and async everywhere in exchange for surviving a restart, which matters only during a deploy and which users recover from by making a new room in five seconds.

**Redis from day one.** Buys crash-survival and a scaling path, costs a service dependency in local development and CI plus async mutation for state that is currently free to touch. Reconsider when a single process is actually the constraint.

**Persisting only finished games.** Tempting: it would give a puzzle history and a durable streak. Rejected because it drags in a database for a feature nobody has asked for. The most likely of these to be revisited, and it can be added without disturbing live room storage.

**Serializing rooms to disk on shutdown.** Half a persistence layer with none of the guarantees. It survives a graceful deploy and not a crash, which is the failure that matters.
