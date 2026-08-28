# ADR-0005: Reconnect tokens for player identity

- **Status**: Accepted
- **Date**: 2026-08-02
- **Context**: [design-spec.md §9](../design-spec.md#9-rooms-identity-lifecycle) · [architecture.md §4](../architecture.md#4-join-and-reconnect)

## Context

The prototype identified players by their **display name string**, which produced a specific set of failures:

- Two players typing "Nik" silently overwrote each other.
- A refresh created a new player; the old one stayed in the roster forever, because `disconnect` was an empty stub.
- Host status was a client-supplied boolean the server trusted.
- There was no socket-to-player mapping, so the server could not tell who sent an op.

The rebuild has no accounts and no database ([ADR-0002](0002-in-memory-rooms-no-database.md)), so identity cannot come from a login. It still has to survive a page refresh, because refreshing mid-puzzle is normal and losing your colour, host status, and place in the room is not acceptable.

## Decision

**Server-issued opaque reconnect tokens, stored client-side, validated on the Socket.IO handshake.**

- On first join the server generates a random 32-byte hex `playerToken` and a `playerId` for the room, mapping `token → playerId`.
- The client stores the token in `localStorage` keyed by room code and sends it in the handshake `auth` on every connect.
- A valid token reattaches the new socket to the existing player, restoring name, colour, and host status.
- **Disconnect does not remove the player.** Their chip dims for a ~2 minute grace period during which the token still reclaims their seat. Host status survives the grace period; only after it expires is the longest-connected player promoted.
- Display names are labels only. They may collide freely and carry no authority.
- Every host-only action is authorized against `playerId === room.hostId`, server-side. The client's `isHost` decides only whether a button renders.

## Consequences

**Good**

- Refreshing mid-solve is a non-event: identity, colour, host status, board, and elapsed timer all return.
- Fixes all four prototype defects with one mechanism.
- The server always knows who sent an op, which is what makes `by` attribution and host authorization possible at all.
- No accounts, no passwords, no PII. Joining stays a two-field form.
- Tokens are room-scoped, so one leaking exposes exactly one room seat.

**Bad**

- **A token is a bearer credential.** Anyone who obtains it becomes that player, including inheriting host. Mitigated by scope (one room), lifetime (dies with the room), and stakes (it is a puzzle game). It is not authentication and should not be described as such.
- `localStorage` is per-browser-profile, so identity does not follow a user across devices, and clearing site data loses their seat.
- The grace period adds real states: a player can be in the roster while disconnected, and the UI must render that rather than pretending they left.
- Two tabs on one room share a token and contend for one seat. Worth detecting and warning about rather than silently misbehaving.

## Alternatives rejected

**Socket ID as identity.** Free and already available, but a new socket ID is issued on every reconnect, which is precisely the case this decision exists to handle.

**Socket.IO `connectionStateRecovery` alone.** It restores a session briefly after a transport drop, does not survive a page reload, and carries no application identity. A complement, not a mechanism.

**Real accounts with a login.** Would give durable identity, cross-device play, and persistent stats. Rejected because it requires a database, credential handling, and a signup wall in front of a product whose appeal is "send a friend a four-letter code".

**Name plus room code as a key.** Cheapest possible fix. Rejected because names collide, are user-editable, and are visible to everyone, so any player could impersonate any other by retyping their name.

**Signed JWT instead of an opaque token.** Would let the server validate without a lookup. Pointless here: the server holds all room state in memory, so the lookup is a `Map.get`.
