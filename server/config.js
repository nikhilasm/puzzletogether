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
 * Where banked puzzles are read from, in order.
 *
 * Two directories rather than one, and the split is a licensing control rather than a technical
 * convenience (ADR-0004). data/crosswords/ is **tracked**, and nothing reaches it without somebody
 * having answered what may legally be served. data/crosswords-local/ is **gitignored wholesale**,
 * and holds the freely-distributed .puz files the importer is developed against: a 15×15 is
 * playable while building, and no copyrighted grid can enter git history by accident.
 *
 * **Overridable by PT_BANK_DIRS**, a delimited list resolved against the working directory; the
 * browser suite sets it to the tracked directory alone. The local overlay is a scratch space that
 * differs from machine to machine, so a test asserting anything about what the bank *holds* would
 * pass or fail on which developer ran it. Same reasoning as the lifecycle timings above: the
 * environment names what the run is about, and the default stays the one a deployment wants.
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
     * Log threshold: debug, info, warn, or error. Development says everything; production says info
     * and above, and turning that down to debug is an environment variable rather than a deploy of
     * different code (ADR-0026). An unrecognised value falls back to info in log.js.
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
