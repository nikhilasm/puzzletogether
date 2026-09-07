/**
 * Server configuration, resolved once at boot.
 *
 * Lifecycle timings are overridable by environment variable specifically so the room GC can be
 * exercised without waiting ten minutes (design-spec.md Verification).
 */

import { delimiter, resolve } from 'node:path';
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
 * Development is signalled by the --dev flag that npm run dev:server passes, so it works
 * identically on Windows and Linux without an env-var prefix.
 */
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

/**
 * Where banked puzzles are read from, in order: the tracked data/crosswords/ (nothing reaches it
 * without a licensing answer) and the gitignored data/crosswords-local/ scratch space (ADR-0004).
 * Overridable by PT_BANK_DIRS, which the browser suite sets to the tracked directory alone so a
 * test does not depend on which developer's local overlay is present.
 */
const bankDirs = process.env.PT_BANK_DIRS
    ? process.env.PT_BANK_DIRS.split(delimiter)
          .filter(Boolean)
          .map((path) => resolve(path))
    : ['../data/crosswords', '../data/crosswords-local'].map((path) =>
          fileURLToPath(new URL(path, import.meta.url)),
      );

export const config = {
    isDev,
    /**
     * Log threshold: debug, info, warn, or error, set by environment variable rather than a deploy
     * of different code (ADR-0026). An unrecognised value falls back to info in log.js.
     */
    logLevel: process.env.PT_LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    port: intFromEnv('PORT', 3001),
    clientDist: fileURLToPath(new URL('../client/dist', import.meta.url)),
    bankDirs,
    disconnectGraceMs: intFromEnv('PT_DISCONNECT_GRACE_MS', DISCONNECT_GRACE_MS),
    gcSweepIntervalMs: intFromEnv('PT_GC_SWEEP_INTERVAL_MS', GC_SWEEP_INTERVAL_MS),
    roomIdleLimitMs: intFromEnv('PT_ROOM_IDLE_LIMIT_MS', ROOM_IDLE_LIMIT_MS),
    roomMaxAgeMs: intFromEnv('PT_ROOM_MAX_AGE_MS', ROOM_MAX_AGE_MS),
};
