/**
 * Server configuration, resolved once at boot.
 *
 * Lifecycle timings are overridable by environment variable specifically so the room GC can be
 * exercised without waiting ten minutes (design-spec.md Verification).
 */

import { fileURLToPath } from 'node:url';

import {
    DISCONNECT_GRACE_MS,
    GC_SWEEP_INTERVAL_MS,
    ROOM_IDLE_LIMIT_MS,
    ROOM_MAX_AGE_MS,
} from '../shared/constants.js';

/** Reads a positive integer from the environment, falling back when unset or unparseable. */
function intFromEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Development is signalled by the `--dev` flag that `npm run dev:server` passes, so it works
 * identically on Windows and Linux without an env-var prefix.
 */
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

export const config = {
    isDev,
    port: intFromEnv('PORT', 3000),
    clientDist: fileURLToPath(new URL('../client/dist', import.meta.url)),
    disconnectGraceMs: intFromEnv('PT_DISCONNECT_GRACE_MS', DISCONNECT_GRACE_MS),
    gcSweepIntervalMs: intFromEnv('PT_GC_SWEEP_INTERVAL_MS', GC_SWEEP_INTERVAL_MS),
    roomIdleLimitMs: intFromEnv('PT_ROOM_IDLE_LIMIT_MS', ROOM_IDLE_LIMIT_MS),
    roomMaxAgeMs: intFromEnv('PT_ROOM_MAX_AGE_MS', ROOM_MAX_AGE_MS),
};
