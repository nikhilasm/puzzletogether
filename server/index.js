/**
 * Process entry point: one Express app, one Socket.IO server, one room store (architecture.md §1).
 * Vite serves the client and proxies /socket.io here in development; in production this process
 * serves client/dist, and there is no gameplay REST API.
 */

import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

import express from 'express';
import { Server } from 'socket.io';

import { DEFAULT_SETTINGS } from '../shared/constants.js';

import pkg from '../package.json' with { type: 'json' };
import { config } from './config.js';
import { log } from './log.js';
import { closeRoom, registerConnectionHandler } from './net/handlers.js';
import { closeProvider, loadBankFrom, prewarm } from './puzzles/provider.js';
import { connectedCount, startRoomGc } from './rooms/lifecycle.js';
import { allRooms, roomCount } from './rooms/store.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { serveClient: false });

app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
});

// In production the built client is static files off the same origin, so no CORS story exists.
if (!config.isDev && existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.use((request, response, next) => {
        if (request.method !== 'GET' || request.path.startsWith('/api')) {
            next();
            return;
        }
        response.sendFile(join(config.clientDist, 'index.html'));
    });
}

registerConnectionHandler(io);

const stopGc = startRoomGc({
    sweepIntervalMs: config.gcSweepIntervalMs,
    idleLimitMs: config.roomIdleLimitMs,
    maxAgeMs: config.roomMaxAgeMs,
    onDelete: (room, reason) => {
        // Before the delete, not after: once the room is out of the map there is no channel left to
        // say anything on, and anybody still in it would be left holding a screen that has stopped
        // being connected to anything (ADR-0025).
        closeRoom(io, room);
        // connected is the field to read: an aged-out room takes live seats with it, and that is
        // the collection somebody felt.
        log.info('room.collected', {
            roomCode: room.code,
            reason,
            ageMs: Date.now() - room.createdAt,
            idleMs: Date.now() - room.lastActivityAt,
            players: room.players.size,
            connected: connectedCount(room),
        });
    },
});

prewarm(DEFAULT_SETTINGS);

// Read before the first socket can connect: the catalog rides the join ack, so a client must never
// be able to arrive while the server still does not know what it can serve.
const banked = loadBankFrom(config.bankDirs);

httpServer.listen(config.port, () => {
    // The version and the pid are what a deployment is identified by afterwards: the first question
    // asked of a log is which build wrote it.
    log.info('server.started', {
        version: pkg.version,
        port: config.port,
        mode: config.isDev ? 'development' : 'production',
        node: process.version,
        pid: process.pid,
        logLevel: config.logLevel,
    });
    // Zero is a normal state, not a failure: a build with no licensed bank offers five puzzle
    // types (ADR-0004). Said out loud so it is never a silent surprise.
    log.info('bank.loaded', { puzzles: banked, crosswordOffered: banked > 0 });
});

/** How many seats exist across every live room, connected or inside their grace period. */
function seatCount() {
    return allRooms().reduce((total, room) => total + room.players.size, 0);
}

// Releases the generator worker and the GC interval so node --watch and Docker stop cleanly.
async function shutdown(signal) {
    // Every room is in memory and goes with the process (ADR-0002), so what a restart cost is a
    // number only this line can report.
    log.info('server.stopping', { signal, rooms: roomCount(), seats: seatCount() });
    stopGc();
    await closeProvider();
    io.close();
    httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Node prints a bare stack and exits on an uncaught throw, which says nothing about what the
// process was holding. Logged first, then the exit stands: the state after one is not trustworthy.
process.on('uncaughtException', (error) => {
    log.error('process.uncaughtException', { rooms: roomCount(), seats: seatCount(), err: error });
    process.exit(1);
});

// A rejection nobody handled is survived rather than fatal, because the alternative is every room
// in memory dying for one request's bug (ADR-0026).
process.on('unhandledRejection', (reason) => {
    log.error('process.unhandledRejection', { err: reason });
});
