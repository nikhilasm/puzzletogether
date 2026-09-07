/**
 * Browser-test configuration; everything in tests/ needs a real engine, a real socket, and in places
 * two real clients. Firefox is not optional, since the grid uses sub-pixel borders and the one
 * alignment bug that reached a user was Firefox-only; the runner builds and starts the server itself.
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
    /*
     * The server is always built and started fresh, never reused. Reusing one would test whatever
     * bundle was current when a leftover server started; a stale process once turned a green suite into
     * 21 failures against a day-old build, so the rebuild per run is worth its few seconds.
     */
    webServer: {
        command: 'npm run build && node server/index.js',
        url: BASE_URL,
        /*
         * The tracked bank only, never the gitignored overlay beside it. data/crosswords-local/ holds
         * whatever a developer last imported, so reading it would assert against a different bank on
         * every machine.
         */
        env: { PORT: String(PORT), PT_BANK_DIRS: 'data/crosswords' },
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
