/**
 * What a log record has to hold to be worth having: the event, the fields as fields, and a thrown
 * value described rather than flattened.
 *
 * The threshold is read once at import, which is what these tests reload the module for.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

/** A logger loaded at the given level, since the threshold is fixed when the module first runs. */
async function loadLog(level) {
    vi.resetModules();
    vi.stubEnv('PT_LOG_LEVEL', level);
    return (await import('./log.js')).log;
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('log', () => {
    it('writes one JSON record carrying the event and its fields', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        const log = await loadLog('info');

        log.info('room.created', { roomCode: 'abcd', rooms: 3 });

        expect(info).toHaveBeenCalledTimes(1);
        const record = JSON.parse(info.mock.calls[0][0]);
        expect(record).toMatchObject({
            level: 'info',
            event: 'room.created',
            roomCode: 'abcd',
            rooms: 3,
        });
        expect(typeof record.t).toBe('string');
    });

    it('says nothing below the threshold', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        const log = await loadLog('warn');

        log.debug('socket.connected', {});
        log.info('room.created', {});

        expect(info).not.toHaveBeenCalled();
    });

    // An Error has no enumerable own properties, so a field holding one serialises to {} and the
    // record says nothing at all. This is the whole reason err is a named field.
    it('describes a thrown value instead of serialising it away', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const log = await loadLog('info');

        log.error('handler.failed', { event: 'game:op', err: new TypeError('no cell') });

        const record = JSON.parse(error.mock.calls[0][0]);
        expect(record.err).toMatchObject({ name: 'TypeError', message: 'no cell' });
        expect(record.err.stack).toContain('no cell');
    });
});
