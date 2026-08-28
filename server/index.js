/**
 * Process entry point: one Express app, one Socket.IO server, one room store (architecture.md §1).
 *
 * In development Vite serves the client on 5173 and proxies /socket.io here; in production this
 * process also serves client/dist. There is no gameplay REST API; all of it is Socket.IO.
 */

import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

import express from 'express';
import { Server } from 'socket.io';

import { DEFAULT_SETTINGS } from '../shared/constants.js';

import { config } from './config.js';
import { registerConnectionHandler } from './net/handlers.js';
import { closeProvider, loadBankFrom, prewarm } from './puzzles/provider.js';
import { startRoomGc } from './rooms/lifecycle.js';

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
    onDelete: (room) => {
        if (config.isDev) console.info(`[gc] collecting room ${room.code}`);
    },
});

prewarm(DEFAULT_SETTINGS);

// Read before the first socket can connect: the catalog rides the join ack, so a client must never
// be able to arrive while the server still does not know what it can serve.
const banked = loadBankFrom(config.bankDirs);

httpServer.listen(config.port, () => {
    const mode = config.isDev ? 'development' : 'production';
    console.info(`PuzzleTogether server listening on :${config.port} (${mode})`);
    // Zero is a normal state, not a failure: a build with no licensed bank offers three puzzle
    // types (ADR-0004). Said out loud so it is never a silent surprise.
    console.info(
        banked > 0
            ? `crossword bank: ${banked} puzzle${banked === 1 ? '' : 's'}`
            : 'crossword bank: empty, the type is not offered',
    );
});

// Releases the generator worker and the GC interval so node --watch and Docker stop cleanly.
async function shutdown() {
    stopGc();
    await closeProvider();
    io.close();
    httpServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
