# ADR-0026: One log record per event, and no dependency to write it

**Status**: accepted · **Date**: 2026-09-04 · **Phase**: 5

- **Context**: [architecture.md §8](../architecture.md#8-logging) · [ADR-0002](0002-in-memory-rooms-no-database.md), which is why a restart is worth a line

## Context

The server said nine things, and two of the useful ones were behind `config.isDev`: the room
collector and the socket connect. A production process therefore reported its port, its bank size,
and whatever the pool complained about, and nothing else. Everything a report is actually phrased as
was invisible: a room that ended, a player who could not get back in, a puzzle that failed to
generate.

Nothing carried a room code or a player id either, so two lines from concurrent rooms could not be
told apart, and the format was a sentence with values interpolated into it, which is greppable only
if you already know the sentence.

The rooms are in memory and die with the process ([ADR-0002](0002-in-memory-rooms-no-database.md)),
so there is no database to reconstruct a session from afterwards. The log is the only record that
outlives a room.

## Decision

**One module, `server/log.js`, writing one record per event, and no logging dependency.**

- **An event is a name plus fields**, never a sentence: `log.info('room.collected', { roomCode,
  reason, ageMs })`. Names are `domain.action`, and the fields are flat, so a search filters on a
  value rather than matching a phrase that may be reworded next month.
- **JSON per line in production, a readable line in development.** Same records either way; only the
  rendering differs. `err` is the one field name with a meaning: an `Error` there is described to
  `{ name, message, stack }`, because an `Error` has no enumerable own properties and serialises to
  `{}`, which is a log line that says a failure happened and nothing about what it was.
- **The threshold is `PT_LOG_LEVEL`, not `isDev`.** A diagnostic compiled out of the production
  build is a line you do not have on the one machine you need it from. Development defaults to
  `debug`, production to `info`, and turning production up is an environment variable.
- **Nothing on the op or focus path logs.** Both run at rate-limit speed per socket, so a record per
  event puts I/O in the hot path ([architecture.md §3](../architecture.md#3-op-lifecycle)).
- **A reconnect token and a solution are never fields.** A token is a seat credential; a solution is
  the puzzle.
- **An unhandled rejection is logged and survived; an uncaught exception is logged and fatal.** The
  asymmetry is the room map: a rejection nobody handled is one request's bug, and killing the
  process for it costs every room in memory, while the state after an uncaught throw is not worth
  trusting with the next op.

## Consequences

- Every new server module writes through `log`, and a `console.*` call in `server/` is a review
  failure. There is no lint rule for it; `server/` is not linted
  ([code-style.md §10](../code-style.md#10-enforcement)).
- Two tests that asserted on log sentences now assert on event names, which is the more stable half
  of the record.
- The log holds room codes, and a room code is a join credential. Wherever these lines are shipped
  is a place that can join rooms.
- A field added to an event is a field a search may already be relying on. Names and reasons are a
  contract with whatever reads them, in the same way the socket protocol is.

## Alternatives rejected

**pino.** Faster, with redaction, transports, and child loggers that would bind a room code once per
socket rather than at every call site. Rejected for now because it is a production dependency for
about forty lines of behaviour, and the throughput argument does not apply to a log that deliberately
sits off the hot path. The record shape here is pino's, so adopting it later is a rewrite of one
module and no call sites.

**Structured logging on the op path, sampled.** An op record would answer desync questions directly.
Rejected because sampling is a knob that is wrong in both directions: too low to catch the rare bug,
or high enough to matter at 10 ops a second per player. The client asking for a snapshot already
marks the case worth looking at.

**Keeping the sentences and adding a prefix.** Cheapest change, and it is what the pool and bank
already did with `[pool]` and `[bank]`. Rejected because the value that matters is inside the
sentence: `refill failed for sudoku:hard:9x9` cannot be filtered by type or by difficulty without
parsing English.
