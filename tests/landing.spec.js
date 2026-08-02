/**
 * The landing screen: two tabs over one form, and what each of them shows.
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('pt-landing').waitFor();
});

test('offers exactly two tabs, Create first', async ({ page }) => {
    const tabs = page.locator('pt-landing [role=tab]');
    await expect(tabs).toHaveCount(2);
    await expect(tabs).toHaveText(['Create', 'Join']);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
});

test('Create shows a name and nothing else', async ({ page }) => {
    await expect(page.locator('#name')).toHaveCount(1);
    await expect(page.locator('#code')).toHaveCount(0);
    await expect(page.locator('pt-landing button[type=submit]')).toHaveText('Create a room');
});

test('Join adds the room code', async ({ page }) => {
    await page.locator('pt-landing [role=tab]').last().click();
    await expect(page.locator('#code')).toHaveCount(1);
    await expect(page.locator('pt-landing button[type=submit]')).toHaveText('Join room');
});

test('keeps the typed name across a change of tab', async ({ page }) => {
    await page.locator('#name').fill('Ada');
    await page.locator('pt-landing [role=tab]').last().click();
    await expect(page.locator('#name')).toHaveValue('Ada');
});

test('tabs read as text with a rule under them, not as buttons', async ({ page }) => {
    const tab = page.locator('pt-landing .tab').first();
    const style = await tab.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
            top: computed.borderTopWidth,
            left: computed.borderLeftWidth,
            right: computed.borderRightWidth,
            bottom: computed.borderBottomWidth,
            background: computed.backgroundColor,
            bottomColor: computed.borderBottomColor,
        };
    });
    expect(style.top).toBe('0px');
    expect(style.left).toBe('0px');
    expect(style.right).toBe('0px');
    expect(style.bottom).not.toBe('0px');
    expect(style.background).toBe('rgba(0, 0, 0, 0)');

    // The selected tab is the one carrying the accent rule.
    const accent = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    const [r, g, b] = style.bottomColor.match(/\d+/g).map(Number);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    expect(hex).toBe(accent.toLowerCase());
});

test('only the selected tab is in the tab order, and arrows move between them', async ({
    page,
}) => {
    const tabs = page.locator('pt-landing [role=tab]');
    await expect(tabs.first()).toHaveAttribute('tabindex', '0');
    await expect(tabs.last()).toHaveAttribute('tabindex', '-1');

    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    expect(await tabs.last().evaluate((el) => el.getRootNode().activeElement === el)).toBe(true);
});

test('reports a room code that names no room', async ({ page }) => {
    await page.locator('pt-landing [role=tab]').last().click();
    await page.locator('#name').fill('Ada');
    await page.locator('#code').fill('zzzz');
    await page.locator('pt-landing button[type=submit]').click();
    await expect(page.locator('pt-landing .error')).toBeVisible();
});

test('asks for a name before anything else', async ({ page }) => {
    // Whitespace, not empty: an empty field is stopped by the browser's own required-field
    // validation, so this is the case the app itself has to answer for.
    await page.locator('#name').fill('   ');
    await page.locator('pt-landing button[type=submit]').click();
    await expect(page.locator('pt-landing .error')).toHaveText('enter a name first');
});
