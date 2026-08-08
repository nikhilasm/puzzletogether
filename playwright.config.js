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
    /*
     * The server is always built and started fresh, never reused.
     *
     * `reuseExistingServer: !CI` is the usual setting and it is a trap here, because the command
     * below *builds* — so reusing a server means testing whatever bundle was current when that
     * server started. A leftover process from an earlier session once turned a green suite into 21
     * identical failures against a day-old build, which is the worst kind of test result: confident,
     * detailed, and about the wrong code.
     *
     * The cost is a rebuild and a restart per run, which is a few seconds. The benefit is that a
     * port already in use now fails loudly instead of quietly answering with the wrong app.
     */
    webServer: {
        command: 'npm run build && node server/index.js',
        url: BASE_URL,
        /*
         * The tracked bank only, never the gitignored overlay beside it. What `data/crosswords-local/`
         * holds is whatever a developer last imported, so a suite that reads it asserts against a
         * different bank on every machine — and the picker's own tests are about what the bank
         * contains.
         */
        env: { PORT: String(PORT), PT_BANK_DIRS: 'data/crosswords' },
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
