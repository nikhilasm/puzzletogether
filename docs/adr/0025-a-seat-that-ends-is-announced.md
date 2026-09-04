# ADR-0025: A seat that ends is announced

**Status**: accepted · **Date**: 2026-09-03 · **Phase**: 5

## Context

A room can stop being yours in five ways. The host removes you; another tab of your own browser
claims the seat; the garbage collector deletes the room out from under you; the server restarts and
takes every in-memory room with it; or you are away past the grace period and the seat is dropped.

Exactly one of those five was announced. `room:kick` told the removed player over their own socket
before the seat went. The other four were left for the client to work out, and it could not:

- The collector deleted a room that had aged out while people were still connected in it. Nothing
  was sent. Their sockets stayed open, `currentSeat()` returned null for every subsequent request,
  and each op came back refused. The screen went on drawing a grid nobody was playing.
- A restart, which in development is any edit to a server file under `node --watch`, wiped `ROOMS`.
  The client reconnected, the handshake token restored nothing, and the server answered
  `ROOM_NOT_FOUND`. The store recorded the error and left `state.room` exactly where it was, so
  `<pt-app>` kept rendering `<pt-game>` over a seat that no longer existed.
- `SEAT_TAKEN` did the same thing to the losing tab, and worse: the server closes that socket, so
  Socket.IO does not retry, and the tab sat on a frozen grid indefinitely.

All three end in the same place, which the room's own history already has a name for: a ghost. The
prototype's ghosts were players leaking into rooms; these are rooms leaking into players.

## Decision

**A seat that ends is announced by whoever ended it, and the client answers every announcement the
same way.**

- **`ROOM_CLOSED` is a new error code**, pushed to everyone still in a room the server is about to
  delete. `closeRoom()` in `net/handlers.js` emits it on the room channel and then disconnects the
  sockets, in that order, and the collector's `onDelete` calls it *before* the room leaves the map,
  because after that there is no channel left to say anything on. Only a room that ages out ever
  ends under anybody: the idle sweep collects rooms with nobody connected, so it has no one to tell.
- **A token that restores nothing gets one of two answers, not one.** The room being gone and the
  seat being gone are different news, and `ROOM_NOT_FOUND` said over a room that is alive and full
  of people sends a player away from one they could walk straight back into. A live room with a dead
  token now answers `NOT_IN_ROOM`.
- **`SEAT_ENDED` in `shared/protocol.js` names the five codes** that mean *the seat this socket held
  is gone*: `KICKED`, `ROOM_CLOSED`, `ROOM_NOT_FOUND`, `NOT_IN_ROOM`, `SEAT_TAKEN`. The client
  branches on the set, never on the individual codes, so a sixth way to lose a seat is an entry in a
  list rather than a sixth branch in the store.
- **The store answers all five through one path.** `#endSeat()` is `leave()` with a reason attached:
  the token goes, the socket goes, the state resets, and what survives is a `state.ended` slice
  holding the code and the message. There is one path out of a room and one shape of state after it,
  whoever decided it.
- **The reason is said in a dialog, red-accented**, `<pt-seat-ended>`, held by `<pt-app>` because
  the screen it belongs to is the one that has just gone. Dismissing it routes to `#/`, which is
  where Leave Room lands: however a seat ends, it ends in the same place.

**The one ending that does not kill the token is `SEAT_TAKEN`**, because it does not kill the seat.
The other tab is sitting in it and holding that same token to do so, and two tabs share one
`localStorage`; clearing it would take the identity out from under the tab that won.

## Consequences

- Any future way of ending a seat has to announce itself and add its code to `SEAT_ENDED`. That is
  the constraint this record exists to impose: silence is what produced every ghost above.
- `--danger` now paints something that is not a control, which [brand.md §4](../brand.md) records.
  It stays outlined: the rule and the heading take the colour and the ground stays paper.
- A room ending is now visible in development the moment it happens, which is what makes an edit to
  a server file legible rather than mysterious.
- The browser suite cannot provoke the collector or a restart, so two tabs stand in for all five in
  `tests/room.spec.js`; the server's half is covered by unit tests over `closeRoom` and the sweep.

## Alternatives rejected

**Letting the client infer it from refused requests.** Every op already comes back with
`NOT_IN_ROOM`, so the store could notice and give up the seat. Rejected because it is silent until
the player touches something: a room that ended while they were reading a clue stays on screen
looking playable, and the news arrives as a consequence of an action they took rather than of the
thing that actually happened. It also makes an ack code load-bearing for a state change, so an
ordinary rate-limit refusal is one typo away from ejecting somebody.

**A heartbeat, with the client giving up after n missed replies.** It answers a question nobody
asked: the socket already knows whether it is connected, and being connected was never the problem.
It would also fire on a slow network, ending seats that were fine.

**Keeping the room on screen with a banner over it.** Considered for the collected-room case, on the
grounds that the grid is still interesting to look at. Rejected because every control on it lies:
the keys write nothing, Check answers nothing, and the roster lists people who cannot see you. A
screen that cannot do anything it offers is worse than no screen.

**Reusing `<pt-confirm>` with a danger variant.** It is a two-button question and this is a
one-button statement, and the roles differ: `alertdialog` versus `dialog`. Bending one into the
other would have made both harder to read than the fifty lines the second one costs.
