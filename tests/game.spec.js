/**
 * The game screen's chrome: the keypad, the Notes switch, the assist controls, and the way out.
 *
 * Also the app-wide styling rules that only a browser can confirm — one focus colour and one
 * control radius, both of which are distributed into every shadow root by hand and so can only be
 * checked where they land.
 */

import { expect, test } from '@playwright/test';

import { createRoom, firstEditableCell, startPuzzle } from './helpers.js';

/** `rgb(r, g, b)` as `#rrggbb`, so it can be compared against a token. */
function toHex(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The ring a control draws when it is focused from the keyboard. */
async function focusRingOf(page, selector) {
    // Chromium only treats a programmatic focus as :focus-visible once the page has seen a key.
    await page.keyboard.press('Tab');
    return page
        .locator(selector)
        .first()
        .evaluate((el) => {
            el.focus();
            const style = getComputedStyle(el);
            return { color: style.outlineColor, width: style.outlineWidth };
        });
}

test.describe('shape and focus', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);
    });

    test('chrome is a rounded rectangle and the puzzle is square', async ({ page }) => {
        const radius = (selector) =>
            page
                .locator(selector)
                .first()
                .evaluate((el) => getComputedStyle(el).borderRadius);

        for (const selector of [
            'pt-keypad .digits button',
            'pt-keypad .actions button',
            'pt-player-chips .chip',
            'pt-switch button',
            'pt-game .puzzle-actions button',
        ]) {
            expect(await radius(selector), selector).toBe('6px');
        }

        expect(await radius('pt-sudoku-board .frame')).toBe('0px');
        // ...and it is opaque, so the page's graph-paper texture is the surface the puzzle sits on
        // rather than a second, unaligned grid showing through the real one.
        const frame = await page
            .locator('pt-sudoku-board .frame')
            .evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(frame).not.toBe('rgba(0, 0, 0, 0)');
        expect(await radius('pt-cell')).toBe('0px');
        // The one round thing: a switch track is a track, not a box.
        expect(await radius('pt-switch .track')).toBe('999px');
    });

    test('every control focuses in the accent, in both themes', async ({ page }) => {
        const selectors = [
            'pt-keypad .digits button',
            'pt-keypad .actions button',
            'pt-mode-toggle pt-switch button',
            'footer pt-switch button',
            'pt-sudoku-board .grid',
            'pt-game .puzzle-actions button',
        ];

        for (const theme of ['light', 'dark']) {
            if (theme === 'dark') await page.locator('footer pt-switch button').click();
            const accent = await page.evaluate(() =>
                getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
            );

            for (const selector of selectors) {
                const ring = await focusRingOf(page, selector);
                expect(toHex(ring.color), `${theme}: ${selector}`).toBe(accent.toLowerCase());
                expect(ring.width, `${theme}: ${selector}`).toBe('2px');
            }
        }
    });

    test('icons are decorative and take the colour of the control they sit in', async ({
        page,
    }) => {
        await expect(page.locator('pt-keypad .actions button svg.icon')).toHaveCount(2);
        await expect(page.locator('pt-mode-toggle svg.icon')).toHaveCount(1);
        await expect(page.locator('footer svg.icon')).toHaveCount(1);
        await expect(page.locator('pt-game .leave svg.icon')).toHaveCount(1);

        const total = await page.locator('svg.icon').count();
        expect(await page.locator('svg.icon[aria-hidden=true]').count()).toBe(total);

        const [stroke, color] = await Promise.all([
            page
                .locator('pt-keypad .actions button svg.icon')
                .first()
                .evaluate((el) => getComputedStyle(el).stroke),
            page
                .locator('pt-keypad .actions button')
                .first()
                .evaluate((el) => getComputedStyle(el).color),
        ]);
        expect(stroke).toBe(color);
    });

    test('keeps its words beside its icons', async ({ page }) => {
        await expect(page.locator('pt-keypad .actions button').first()).toHaveText('Erase');
        await expect(page.locator('pt-keypad .actions button').last()).toHaveText('Undo');
        await expect(page.locator('pt-game .leave button')).toHaveText('Leave room');

        const actions = page.locator('pt-game .puzzle-actions button');
        await expect(actions).toHaveText(['Puzzle Select', 'Check', 'Reveal']);
    });

    test('the puzzle actions are one row, apart from the keys', async ({ page }) => {
        const rows = await page.locator('pt-game').evaluate((game) => {
            const buttons = [...game.shadowRoot.querySelectorAll('.puzzle-actions button')];
            const keypad = game.shadowRoot.querySelector('pt-keypad').getBoundingClientRect();
            return {
                tops: buttons.map((el) => Math.round(el.getBoundingClientRect().top)),
                belowKeypad: buttons[0].getBoundingClientRect().top > keypad.bottom,
            };
        });

        expect(new Set(rows.tops).size, 'all three share a row').toBe(1);
        expect(rows.belowKeypad).toBe(true);
    });
});

test.describe('the notice line', () => {
    test('says nothing and takes no room when there is nothing to say', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const height = () =>
            page.locator('pt-game .notice').evaluate((el) => el.getBoundingClientRect().height);

        expect(await height()).toBe(0);

        // A keypad press with no cell selected is the cheapest notice to provoke.
        await page.locator('pt-keypad .digits button').first().click();
        await expect(page.locator('pt-game .notice')).toHaveText('pick a square first');
        expect(await height()).toBeGreaterThan(10);

        // It sits under the keys whose result it reports, not down among the puzzle actions.
        const order = await page.locator('pt-game').evaluate((game) => {
            const box = (sel) => game.shadowRoot.querySelector(sel).getBoundingClientRect();
            return {
                keypad: box('pt-keypad').bottom,
                notice: box('.notice').top,
                actions: box('.puzzle-actions').top,
            };
        });
        expect(order.notice).toBeGreaterThanOrEqual(order.keypad);
        expect(order.notice).toBeLessThan(order.actions);
    });
});

test.describe('input mode', () => {
    test('Notes is a switch, sitting above the digits it changes the meaning of', async ({
        page,
    }) => {
        await createRoom(page);
        await startPuzzle(page);

        const notes = page.locator('pt-mode-toggle pt-switch button');
        await expect(notes).toHaveAttribute('role', 'switch');
        await expect(notes).toHaveAttribute('aria-checked', 'false');
        await expect(notes).toHaveText('Notes');

        const geometry = await page.locator('pt-game').evaluate((game) => {
            const box = (sel) => game.shadowRoot.querySelector(sel).getBoundingClientRect();
            return {
                board: box('.board').bottom,
                mode: box('pt-mode-toggle').top,
                keypad: box('pt-keypad').top,
            };
        });
        expect(geometry.mode).toBeLessThan(geometry.keypad);
        expect(geometry.mode).toBeGreaterThanOrEqual(geometry.board - 40);
    });

    test('flips, slides, and writes a pencil mark', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const notes = page.locator('pt-mode-toggle pt-switch button');
        const knob = () =>
            page.locator('pt-mode-toggle .knob').evaluate((el) => getComputedStyle(el).transform);

        const before = await knob();
        await notes.click();
        await expect(notes).toHaveAttribute('aria-checked', 'true');
        // Polled, because the knob slides rather than jumps — reading it the instant the state
        // flips catches the transform it is travelling from.
        await expect.poll(knob).not.toBe(before);

        const cell = await firstEditableCell(page);
        await page.locator(`pt-cell >> nth=${cell}`).click();
        await page.locator('pt-keypad .digits button').first().click();

        await expect
            .poll(() =>
                page.locator(`pt-cell >> nth=${cell}`).evaluate((el) => (el.marks ?? []).length),
            )
            .toBeGreaterThan(0);
    });
});

test.describe('the theme switch', () => {
    test('darkens the page and remembers it', async ({ page }) => {
        await createRoom(page);

        const theme = page.locator('footer pt-switch button');
        await expect(theme).toHaveAttribute('role', 'switch');
        await expect(theme).toHaveText('Dark theme');
        await expect(theme).toHaveAttribute('aria-checked', 'false');

        await theme.click();
        await expect(theme).toHaveAttribute('aria-checked', 'true');
        await expect
            .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
            .toBe('dark');
        expect(await page.evaluate(() => localStorage.getItem('pt:theme'))).toBe('dark');
    });
});

test.describe('leaving mid-puzzle', () => {
    test('the game screen offers the same way out as Puzzle Select', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        await page.locator('pt-game .leave button').click();
        await expect(page.locator('pt-landing')).toBeVisible();
        await expect(page.locator('pt-player-chips')).toHaveCount(0);
        expect(await page.evaluate(() => window.location.hash)).toBe('#/');
    });
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 320, height: 720 } });

    test('fits, and keeps its controls tappable', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const overflow = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

        for (const selector of [
            'pt-mode-toggle pt-switch button',
            'pt-keypad .actions button',
            'footer pt-switch button',
        ]) {
            const box = await page.locator(selector).first().boundingBox();
            expect(box.height, selector).toBeGreaterThanOrEqual(44);
        }
    });
});
