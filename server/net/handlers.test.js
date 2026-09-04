/**
 * The one thing handlers.js does without a socket having asked for it: closing a room under the
 * people still sitting in it.
 *
 * Everything else in the module is driven by a real socket and is covered by the browser suite.
 */

import { describe, expect, it } from 'vitest';

import { ERROR, SERVER_EVENT } from '../../shared/protocol.js';
import { addPlayer } from '../rooms/lifecycle.js';
import { createRoom } from '../rooms/store.js';

import { closeRoom } from './handlers.js';

/**
 * Enough of a Socket.IO server to record what was said and who was cut loose, in one list so the
 * order of the two is part of what a test can assert.
 */
function fakeIo(log) {
    return {
        to: (code) => ({
            emit: (event, payload) => log.push({ act: 'emit', code, event, payload }),
        }),
        in: (code) => ({ disconnectSockets: () => log.push({ act: 'disconnect', code }) }),
    };
}

describe('closeRoom', () => {
    it('tells the room it has ended, and only then cuts it loose', () => {
        const log = [];
        const room = createRoom();
        addPlayer(room, 'Ada', 'socket-ada');

        closeRoom(fakeIo(log), room);

        // The order is the whole contract. A socket disconnected first never hears the reason,
        // which is the silent ending this exists to prevent.
        expect(log).toEqual([
            {
                act: 'emit',
                code: room.code,
                event: SERVER_EVENT.ERROR,
                payload: { code: ERROR.ROOM_CLOSED, message: expect.any(String) },
            },
            { act: 'disconnect', code: room.code },
        ]);
    });
});
