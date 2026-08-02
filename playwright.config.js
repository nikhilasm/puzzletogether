/**
 * Browser-test configuration. Unit tests live in Vitest beside their modules; everything in
 * `tests/` needs a real engine, a real socket, and in places two real clients.
 *
 * **Firefox is not optional here.** The grid is drawn with sub-pixel borders and a mark grid whose
 * tracks have to resolve identically in both engines, and the one alignment bug that reached a user
 * was Firefox-only — Chromium had rounded it away. A suite that runs in one engine would not have
 * caught it.
 *
 * The server is built and started by the runner, so `npm run test:ui` is the whole command.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PT_TEST_PORT ?? 3111);
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './tests',
    // Rooms are process-global and the assist limiter is per socket, so files must not race.
    workers: 1,
    fullyParallel: false,
    reporter: process.env.CI ? 'line' : [['list']],
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ],
    webServer: {
        command: 'npm run build && node server/index.js',
        url: BASE_URL,
        env: { PORT: String(PORT) },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
