/**
 * Shared moves for the browser tests: getting into a room, and getting a puzzle on screen.
 *
 * Playwright's CSS engine pierces open shadow roots, so the specs read as ordinary selectors and
 * never reach for `shadowRoot` except where they deliberately inspect a component's own state.
 */

import { expect } from '@playwright/test';

/** Fills the landing form on whichever tab is open and submits it. */
export async function submitLanding(page, { name, code }) {
    if (code) await page.locator('pt-landing [role=tab]').last().click();
    await page.locator('#name').fill(name);
    if (code) await page.locator('#code').fill(code);
    await page.locator('pt-landing button[type=submit]').click();
    await page.waitForFunction(() => window.location.hash.startsWith('#/room/'));
}

/** Creates a room as `name` and returns its code. */
export async function createRoom(page, name = 'Ada') {
    await page.goto('/');
    await submitLanding(page, { name });
    return (await page.evaluate(() => window.location.hash)).split('/').pop();
}

/** Joins an existing room as `name`, from a page that has not loaded the app yet. */
export async function joinRoom(page, name, code) {
    await page.goto('/');
    await submitLanding(page, { name, code });
    await page.locator('pt-player-chips').waitFor();
}

/**
 * Starts a puzzle as the host, and waits for the grid.
 *
 * The type is clicked before the size, because choosing a type resets the size to that type's
 * default — a 4×4 nonogram does not exist, so the picker cannot carry a sudoku's size across.
 */
export async function startPuzzle(page, side = '4×4', type = 'Sudoku') {
    await page.locator('pt-puzzle-picker .option', { hasText: type }).click();
    await page.locator('pt-puzzle-picker .option', { hasText: side }).click();
    // Named, not positional: Puzzle Select also carries a Leave room button.
    await page.locator('pt-puzzle-select button', { hasText: 'Start' }).click();
    // Crossword takes the letter pad where the others take the keypad, so wait on whichever the
    // type actually renders rather than assuming the digits.
    await page
        .locator(type === 'Crossword' ? 'pt-letter-pad' : 'pt-keypad')
        .waitFor({ timeout: 30_000 });
    await expect(page.locator('pt-cell').first()).toBeVisible();
}

/** The board element on screen, whichever type it is. */
export function boardOf(page) {
    return page.locator('pt-sudoku-board, pt-kenken-board, pt-nonogram-board, pt-crossword-board');
}

/** The roster as the page currently holds it — the component's own property, not its DOM. */
export function playersOf(page) {
    return page
        .locator('pt-player-chips')
        .evaluate((chips) => chips.players.map((p) => ({ name: p.name, color: p.colorIndex })));
}

/** The first cell index this puzzle lets a player type into. */
export async function firstEditableCell(page) {
    return boardOf(page).evaluate(
        (board) => board.doc.cells.findIndex((cell) => cell.given == null && !cell.block),
        null,
    );
}

/** Selects a cell by index and presses a key on the grid. */
export async function typeInCell(page, index, key) {
    await page.locator(`pt-cell >> nth=${index}`).click();
    await page.keyboard.press(key);
}

/** The box of one cell, relative to the grid, for alignment assertions. */
export async function cellBoxes(page) {
    return boardOf(page).evaluate((board) => {
        const cells = [...board.shadowRoot.querySelectorAll('pt-cell')];
        return cells.map((cell) => {
            const box = cell.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
        });
    });
}
