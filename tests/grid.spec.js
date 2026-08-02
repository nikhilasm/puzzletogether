/**
 * How the grid is drawn: cell geometry, region rules, pencil-mark positions, and presence dots.
 *
 * These are the assertions that a screenshot would have made for us if screenshots were reliable
 * across engines. Every one of them corresponds to something that went wrong once — cells a pixel
 * out in Firefox, marks that moved when their neighbours changed, dots that only landed on the top
 * row — so they are worth their runtime in both browsers.
 */

import { expect, test } from '@playwright/test';

import { cellBoxes, createRoom, firstEditableCell, joinRoom, startPuzzle } from './helpers.js';

/** Positions of one cell's pencil marks, relative to that cell's own top-left corner. */
function markPositions(page, index) {
    return page.locator(`pt-cell >> nth=${index}`).evaluate((cell) => {
        const origin = cell.getBoundingClientRect();
        return Object.fromEntries(
            [...cell.shadowRoot.querySelectorAll('.marks span')].map((span) => {
                const box = span.getBoundingClientRect();
                return [
                    span.textContent.trim(),
                    {
                        x: Math.round(box.x - origin.x),
                        y: Math.round(box.y - origin.y),
                    },
                ];
            }),
        );
    });
}

test.describe('cell geometry', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);
    });

    test('every cell is the same size, region borders included', async ({ page }) => {
        const boxes = await cellBoxes(page);
        expect(boxes).toHaveLength(16);

        const widths = new Set(boxes.map((box) => box.width.toFixed(2)));
        const heights = new Set(boxes.map((box) => box.height.toFixed(2)));
        expect(widths.size, `cell widths: ${[...widths]}`).toBe(1);
        expect(heights.size, `cell heights: ${[...heights]}`).toBe(1);
    });

    test('cells stay square', async ({ page }) => {
        const [box] = await cellBoxes(page);
        expect(Math.abs(box.width - box.height)).toBeLessThan(0.5);
    });

    test('rows share a baseline and columns share an edge', async ({ page }) => {
        const boxes = await cellBoxes(page);

        for (let row = 0; row < 4; row += 1) {
            const tops = boxes.slice(row * 4, row * 4 + 4).map((box) => box.y.toFixed(2));
            expect(new Set(tops).size, `row ${row} tops: ${tops}`).toBe(1);
        }
        for (let col = 0; col < 4; col += 1) {
            const lefts = [0, 1, 2, 3].map((row) => boxes[row * 4 + col].x.toFixed(2));
            expect(new Set(lefts).size, `column ${col} lefts: ${lefts}`).toBe(1);
        }
    });

    test('region rules are drawn over the hairlines, not beside them', async ({ page }) => {
        // A cell on a region boundary keeps the same 1px border as every other cell; the heavy
        // rule is an overlay. That is what stops it mitring with the hairline on the next edge.
        const heavy = await page
            .locator('pt-cell[heavy-right]')
            .first()
            .evaluate((cell) => {
                const overlay = getComputedStyle(cell, '::after');
                return {
                    border: getComputedStyle(cell).borderRightWidth,
                    overlayWidth: overlay.width,
                    overlayContent: overlay.content,
                };
            });
        expect(heavy.border).toBe('1px');
        expect(heavy.overlayContent).not.toBe('none');
        expect(Number.parseFloat(heavy.overlayWidth)).toBeGreaterThan(1);
    });
});

test.describe('pencil marks', () => {
    test('hold their position as other marks come and go', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const cell = await firstEditableCell(page);
        await page.locator(`pt-cell >> nth=${cell}`).click();
        await page.locator('pt-mode-toggle pt-switch button').click();

        await page.locator('pt-keypad .digits button', { hasText: '4' }).click();
        await expect.poll(async () => Object.keys(await markPositions(page, cell))).toEqual(['4']);
        const alone = (await markPositions(page, cell))['4'];

        await page.locator('pt-keypad .digits button', { hasText: '1' }).click();
        await page.locator('pt-keypad .digits button', { hasText: '2' }).click();
        await expect
            .poll(async () => Object.keys(await markPositions(page, cell)).sort())
            .toEqual(['1', '2', '4']);

        expect((await markPositions(page, cell))['4']).toEqual(alone);

        // And back down again: removing its neighbours must not move it either.
        await page.locator('pt-keypad .digits button', { hasText: '1' }).click();
        await expect
            .poll(async () => Object.keys(await markPositions(page, cell)).sort())
            .toEqual(['2', '4']);
        expect((await markPositions(page, cell))['4']).toEqual(alone);
    });

    test('lay out in a grid wide and tall enough for the whole alphabet', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const tracks = await page.locator('pt-sudoku-board').evaluate((board) => ({
            cols: board.markColumns,
            rows: board.markRows,
            alphabet: board.doc.meta.alphabet.length,
        }));
        expect(tracks.cols * tracks.rows).toBeGreaterThanOrEqual(tracks.alphabet);
    });
});

test.describe('presence dots', () => {
    test('land inside the cell they belong to, on every row', async ({ page, browser }) => {
        const code = await createRoom(page);
        await startPuzzle(page);

        const context = await browser.newContext();
        const guest = await context.newPage();
        await joinRoom(guest, 'Grace', code);
        await expect(guest.locator('pt-cell').first()).toBeVisible();

        // The bottom-right cell: the furthest thing from the top row, where this used to work.
        const target = 15;
        await guest.locator(`pt-cell >> nth=${target}`).click();

        const dot = page.locator('pt-presence-layer .dot').first();
        await expect(dot).toBeVisible();

        const placement = await page.locator('pt-sudoku-board').evaluate((board, index) => {
            const cells = board.shadowRoot.querySelectorAll('pt-cell');
            const cell = cells[index].getBoundingClientRect();
            const layer = board.shadowRoot.querySelector('pt-presence-layer');
            const mark = layer.shadowRoot.querySelector('.dot').getBoundingClientRect();
            return {
                cell: { x: cell.x, y: cell.y, right: cell.right, bottom: cell.bottom },
                dot: { x: mark.x + mark.width / 2, y: mark.y + mark.height / 2, size: mark.width },
            };
        }, target);

        expect(placement.dot.x).toBeGreaterThan(placement.cell.x);
        expect(placement.dot.x).toBeLessThan(placement.cell.right);
        expect(placement.dot.y).toBeGreaterThan(placement.cell.y);
        expect(placement.dot.y).toBeLessThan(placement.cell.bottom);

        await context.close();
    });

    test('are big enough to see', async ({ page, browser }) => {
        const code = await createRoom(page);
        await startPuzzle(page);

        const context = await browser.newContext();
        const guest = await context.newPage();
        await joinRoom(guest, 'Grace', code);
        await expect(guest.locator('pt-cell').first()).toBeVisible();
        await guest.locator('pt-cell >> nth=5').click();

        const dot = page.locator('pt-presence-layer .dot').first();
        await expect(dot).toBeVisible();
        // Laid-out size, not the painted box: the dot arrives on a scale animation, and a bounding
        // box caught mid-flight measures the animation rather than the dot.
        const size = await dot.evaluate((el) => getComputedStyle(el).width);
        expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(9);

        await context.close();
    });

    test('recolour the moment their player changes colour', async ({ page, browser }) => {
        const code = await createRoom(page);
        await startPuzzle(page);

        const context = await browser.newContext();
        const guest = await context.newPage();
        await joinRoom(guest, 'Grace', code);
        await expect(guest.locator('pt-cell').first()).toBeVisible();
        await guest.locator('pt-cell >> nth=5').click();

        const dotColor = () =>
            page
                .locator('pt-presence-layer .dot')
                .first()
                .evaluate((el) => getComputedStyle(el).backgroundColor);

        await expect(page.locator('pt-presence-layer .dot')).toBeVisible();
        const before = await dotColor();

        // No reselecting the cell afterwards: the roster changing is the only event involved.
        await guest.locator('pt-player-chips button.chip').click();
        await guest.locator('pt-player-chips .swatch').nth(6).click();

        await expect.poll(dotColor).not.toBe(before);
        await context.close();
    });
});
