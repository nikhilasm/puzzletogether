/**
 * The room itself: the roster, colour picking, removing a player, and the ways out of a room.
 *
 * Two browser contexts wherever "somebody else" has to be a real second player — a colour is only
 * taken if another seat holds it, and a kick is only a kick if it happens to someone.
 */

import { expect, test } from '@playwright/test';

import { createRoom, joinRoom, playersOf, submitLanding } from './helpers.js';

/** Opens a second client in its own context, joined to `code`. */
async function secondPlayer(browser, code, name = 'Grace') {
    const context = await browser.newContext();
    const page = await context.newPage();
    await joinRoom(page, name, code);
    return { context, page };
}

test.describe('the roster', () => {
    test('counts players against the room limit', async ({ page, browser }) => {
        const code = await createRoom(page);
        await expect(page.locator('pt-player-chips .count')).toHaveText('1/8');

        const guest = await secondPlayer(browser, code);
        await expect(page.locator('pt-player-chips .count')).toHaveText('2/8');
        await guest.context.close();
    });

    test('marks which chip is yours, on both clients', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        await expect(page.locator('pt-player-chips .you')).toHaveCount(1);
        await expect(
            page.locator('pt-player-chips li', { hasText: 'Ada' }).locator('.you'),
        ).toBeVisible();
        await expect(
            guest.page.locator('pt-player-chips li', { hasText: 'Grace' }).locator('.you'),
        ).toBeVisible();

        await guest.context.close();
    });

    test('gives every chip the same box, whoever is looking', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        /** The outer box of every chip on one page, rounded to whole pixels. */
        const boxes = (target) =>
            target.locator('pt-player-chips .chip').evaluateAll((chips) =>
                chips.map((chip) => {
                    const box = chip.getBoundingClientRect();
                    return { w: Math.round(box.width), h: Math.round(box.height) };
                }),
            );

        const hostBoxes = await boxes(page);
        const guestBoxes = await boxes(guest.page);

        expect(hostBoxes).toHaveLength(2);
        expect(new Set(hostBoxes.map((b) => `${b.w}x${b.h}`)).size).toBe(1);
        // The same chips on the other client, at the same viewport, must measure the same.
        expect(guestBoxes).toEqual(hostBoxes);

        await guest.context.close();
    });
});

test.describe('choosing a colour', () => {
    test('only your own chip opens the palette', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        await expect(page.locator('pt-player-chips button.chip')).toHaveCount(1);
        await expect(page.locator('pt-player-chips button.chip')).toContainText('Ada');
        await expect(page.locator('pt-player-chips .palette')).toHaveCount(0);

        await page.locator('pt-player-chips button.chip').click();
        await expect(page.locator('pt-player-chips .palette')).toBeVisible();
        await expect(page.locator('pt-player-chips .swatch')).toHaveCount(8);

        await guest.context.close();
    });

    test('shows a taken colour struck through rather than hiding it', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);
        await page.locator('pt-player-chips button.chip').click();

        const taken = page.locator('pt-player-chips .swatch').nth(1);
        await expect(taken).toBeDisabled();
        await expect(taken).toHaveAttribute('aria-label', 'magenta, taken');

        // Two channels, not just the dimming: a grey wash and a slash across it.
        const marks = await taken.evaluate((el) => ({
            overlay: getComputedStyle(el, '::before').backgroundColor,
            slash: getComputedStyle(el, '::after').transform,
            slashHeight: getComputedStyle(el, '::after').height,
        }));
        expect(marks.overlay).not.toBe('rgba(0, 0, 0, 0)');
        expect(marks.slash).not.toBe('none');
        expect(Number.parseFloat(marks.slashHeight)).toBeGreaterThan(0);

        // A free colour carries neither.
        const free = page.locator('pt-player-chips .swatch').nth(4);
        await expect(free).toBeEnabled();
        await expect(free).toHaveAttribute('aria-label', 'teal');

        await guest.context.close();
    });

    test('takes a free colour and shows it to the room', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        await page.locator('pt-player-chips button.chip').click();
        await page.locator('pt-player-chips .swatch').nth(4).click();
        await expect(page.locator('pt-player-chips .palette')).toHaveCount(0);

        await expect
            .poll(async () => (await playersOf(page)).find((p) => p.name === 'Ada').color)
            .toBe(4);
        await expect
            .poll(async () => (await playersOf(guest.page)).find((p) => p.name === 'Ada').color)
            .toBe(4);

        // What the host just released is free again, and what they took is not.
        await guest.page.locator('pt-player-chips button.chip').click();
        await expect(guest.page.locator('pt-player-chips .swatch').nth(4)).toBeDisabled();
        await expect(guest.page.locator('pt-player-chips .swatch').nth(0)).toBeEnabled();

        await guest.context.close();
    });

    test('refuses a taken colour on the server, not just in the picker', async ({
        page,
        browser,
    }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);
        await guest.page.locator('pt-player-chips button.chip').click();

        // Colour 0 is the host's. Strip the guard off and claim it anyway.
        const swatch = guest.page.locator('pt-player-chips .swatch').nth(0);
        await swatch.evaluate((el) => el.removeAttribute('disabled'));
        await swatch.click();

        await expect(guest.page.locator('pt-player-chips .palette-error')).toBeVisible();
        // Still open, because the thing to do about it is pick again.
        await expect(guest.page.locator('pt-player-chips .palette')).toBeVisible();
        expect((await playersOf(guest.page)).find((p) => p.name === 'Grace').color).toBe(1);

        await guest.context.close();
    });

    test('closes on Escape and on a click elsewhere', async ({ page }) => {
        await createRoom(page);

        await page.locator('pt-player-chips button.chip').click();
        await page.keyboard.press('Escape');
        await expect(page.locator('pt-player-chips .palette')).toHaveCount(0);

        await page.locator('pt-player-chips button.chip').click();
        await page.locator('footer p').first().click();
        await expect(page.locator('pt-player-chips .palette')).toHaveCount(0);
    });
});

test.describe('removing a player', () => {
    test('only the host sees a remove control, and never on their own chip', async ({
        page,
        browser,
    }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        await expect(page.locator('pt-player-chips .kick')).toHaveCount(1);
        await expect(page.locator('pt-player-chips .kick')).toHaveAttribute(
            'aria-label',
            'Remove Grace from the room',
        );
        await expect(guest.page.locator('pt-player-chips .kick')).toHaveCount(0);

        await guest.context.close();
    });

    test('confirms first, and cancelling changes nothing', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        await page.locator('pt-player-chips .kick').click();
        await expect(page.locator('pt-player-chips pt-confirm dialog')).toBeVisible();
        await expect(page.locator('pt-player-chips pt-confirm h2')).toContainText('Grace');

        await page.locator('pt-player-chips pt-confirm button', { hasText: 'Cancel' }).click();
        await expect(page.locator('pt-player-chips pt-confirm dialog')).toBeHidden();
        expect(await playersOf(page)).toHaveLength(2);

        await guest.context.close();
    });

    test('removes the seat and tells the player why', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        await page.locator('pt-player-chips .kick').click();
        await page.locator('pt-player-chips pt-confirm button', { hasText: 'Remove' }).click();

        await expect.poll(async () => (await playersOf(page)).length).toBe(1);

        // The removed player lands back at the join form, told what happened.
        await expect(guest.page.locator('pt-landing')).toBeVisible();
        await expect(guest.page.locator('pt-player-chips')).toHaveCount(0);
        await expect(guest.page.locator('.notice[role=alert]')).toContainText('removed you');

        await guest.context.close();
    });
});

test.describe('leaving', () => {
    test('leaves from Puzzle Select and gives up the seat', async ({ page, browser }) => {
        const code = await createRoom(page);
        const guest = await secondPlayer(browser, code);

        const leave = guest.page.locator('pt-puzzle-select .leave button');
        await expect(leave).toHaveText('Leave room');
        await expect(leave.locator('svg.icon')).toHaveCount(1);
        await leave.click();

        await expect(guest.page.locator('pt-landing')).toBeVisible();
        await expect(guest.page.locator('pt-player-chips')).toHaveCount(0);
        await expect(guest.page.locator('.room-code')).toHaveCount(0);
        expect(await guest.page.evaluate(() => window.location.hash)).toBe('#/');

        await expect.poll(async () => (await playersOf(page)).length).toBe(1);
        await guest.context.close();
    });

    test('the back button leaves too, rather than leaving a ghost behind', async ({
        page,
        browser,
    }) => {
        const code = await createRoom(page);
        await page.goBack();

        await expect(page.locator('pt-landing')).toBeVisible();
        await expect(page.locator('pt-player-chips')).toHaveCount(0);
        await expect(page.locator('.room-code')).toHaveCount(0);

        // Proved from outside: a fresh client joining that room finds only itself.
        //
        // Polled, because leaving is a round trip and arriving is a different one. Everything
        // asserted above happens in this browser the moment the route changes; the seat is not
        // actually gone until the server says so, and the observer can finish joining first. Read
        // once, this passed or failed on which message the server happened to handle first.
        const context = await browser.newContext();
        const observer = await context.newPage();
        await joinRoom(observer, 'Alan', code);
        await expect.poll(async () => (await playersOf(observer)).length).toBe(1);
        await context.close();
    });

    test('going forward again offers the join form with the code filled in', async ({ page }) => {
        const code = await createRoom(page);
        await page.goBack();
        await page.goForward();

        await expect(page.locator('pt-landing')).toBeVisible();
        await expect(page.locator('pt-landing [role=tab]').last()).toHaveAttribute(
            'aria-selected',
            'true',
        );
        await expect(page.locator('#code')).toHaveValue(code);

        // And rejoining from there works, which is what makes an accidental back press cheap.
        await submitLanding(page, { name: 'Ada' });
        await expect(page.locator('pt-player-chips')).toBeVisible();
    });
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 320, height: 720 } });

    test('the open palette stays inside the viewport', async ({ page }) => {
        await createRoom(page);
        await page.locator('pt-player-chips button.chip').click();
        await expect(page.locator('pt-player-chips .palette')).toBeVisible();

        const overflow = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

        const swatch = await page.locator('pt-player-chips .swatch').first().boundingBox();
        expect(swatch.width).toBeGreaterThanOrEqual(30);
        expect(swatch.height).toBeGreaterThanOrEqual(30);
    });
});
