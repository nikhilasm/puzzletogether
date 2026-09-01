/**
 * The puzzle picker's browsed shape: the card list a banked type gets, and the filters over it.
 *
 * Two kinds of test here, and the split is deliberate. The **list** is checked against the app a host
 * actually sees, driven by the tracked bank. The **filters** cannot be: they only appear once a bank
 * carries more than one size or more than one difficulty, and data/crosswords/ is four minis that
 * are all 5×5 and all easy, which is exactly the case the filters are meant to stay out of the way
 * of. So they are driven against a picker mounted on its own behind a catalog standing in for a
 * fuller bank. It is still a real element in a real engine; only its input is invented, and inventing
 * it is the point.
 */

import { expect, test } from '@playwright/test';

import { createRoom } from './helpers.js';

/**
 * A bank with something to filter: two sizes sharing a difficulty, three difficulties, and one size
 * that exists only at hard, which is what makes an unreachable pair possible to test for.
 *
 * Listed out of order on both axes on purpose. A catalog arrives in whatever order the bank's files
 * loaded in, and both filter rows are supposed to impose their own.
 */
const BANK = [
    {
        id: 'c',
        title: 'Sunday Special',
        author: 'Grace',
        source: 'CC0',
        size: { rows: 15, cols: 15 },
        difficulty: 'medium',
    },
    {
        id: 'd',
        title: 'The Long Haul',
        author: 'Grace',
        source: 'CC0',
        size: { rows: 21, cols: 20 },
        difficulty: 'hard',
    },
    {
        id: 'a',
        title: 'Warm-Up',
        author: 'Ada',
        source: 'CC0',
        size: { rows: 5, cols: 5 },
        difficulty: 'easy',
    },
    {
        id: 'b',
        title: 'Second Wind',
        author: 'Ada',
        source: 'CC0',
        size: { rows: 5, cols: 5 },
        difficulty: 'medium',
    },
];

/**
 * Puts a lone picker on the landing page with puzzles behind its crossword entry.
 *
 * The landing screen renders no picker of its own, so the one appended here is the only one in the
 * document and the specs below can address it by tag.
 */
async function mountPicker(page, puzzles = BANK) {
    await page.goto('/');
    await page.locator('pt-landing').waitFor();

    await page.evaluate((list) => {
        const picker = document.createElement('pt-puzzle-picker');
        picker.catalog = {
            crossword: {
                sizes: list.map((puzzle) => puzzle.size),
                difficulties: [...new Set(list.map((puzzle) => puzzle.difficulty))],
                puzzles: list,
            },
        };
        picker.spec = { type: 'crossword' };
        document.body.append(picker);
    }, puzzles);

    await page.locator('pt-puzzle-picker .card').first().waitFor();
}

/** The titles currently on show, in order. */
function titlesOn(page) {
    return page.locator('pt-puzzle-picker .card .title').allInnerTexts();
}

/**
 * The spec the picker has resolved to: what Start would be handed right now.
 *
 * Read off the element rather than by listening for pt-spec-change, because the two are the same
 * thing: the picker announces exactly what it holds, which is the property that stops the list
 * showing one card as chosen while Start still carries another.
 */
function resolvedSpec(page) {
    return page.locator('pt-puzzle-picker').evaluate((picker) => picker.spec);
}

test.describe('the card list', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await page.locator('pt-puzzle-picker .option', { hasText: 'Crossword' }).click();
        await page.locator('pt-puzzle-picker .card').first().waitFor();
    });

    test('states both facts the filters narrow on, and says them out loud', async ({ page }) => {
        const card = page.locator('pt-puzzle-picker .card').first();

        await expect(card.locator('.size')).toHaveText('5×5');
        await expect(card.locator('.level')).toHaveText('Easy');
        // A banked puzzle's difficulty is a fact about it rather than a question put to the host, so
        // it rides in the card's accessible name alongside the size rather than living in a column.
        await expect(card).toHaveAttribute('aria-label', /5×5, Easy$/);
    });

    /**
     * The list is given the whole column while the option rows keep a reading measure. A title, an
     * author, and a publication is more than 26rem of text, and at that width the credit line wrapped
     * under every card carrying a real newspaper credit.
     */
    test('takes more room than a row of options would', async ({ page }) => {
        const cards = await page.locator('pt-puzzle-picker .cards').boundingBox();
        expect(cards.width).toBeGreaterThan(480);

        // ...and the page it was widened inside still does not scroll sideways.
        const overflow = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    });

    /**
     * The rule that answers ADR-0009's objection to building filters at all: a filter over four
     * puzzles that are all one size and all one difficulty is clutter, so it is not drawn.
     */
    test('offers no filters over a bank with nothing to filter', async ({ page }) => {
        await expect(page.locator('pt-puzzle-picker .filter')).toHaveCount(0);
        await expect(page.locator('pt-puzzle-picker .list legend')).toHaveText('Choose a puzzle');
    });
});

test.describe('filtering the list', () => {
    test.beforeEach(async ({ page }) => {
        await mountPicker(page);
    });

    test('offers a row per axis, ordered its own way and opening on everything', async ({
        page,
    }) => {
        // Smallest first and easiest first, whatever order the bank handed them over in.
        await expect(page.locator('pt-puzzle-picker .filter-size .option')).toHaveText([
            'Any size',
            '5×5',
            '15×15',
            '20×21',
        ]);
        await expect(page.locator('pt-puzzle-picker .filter-difficulty .option')).toHaveText([
            'Any difficulty',
            'Easy',
            'Medium',
            'Hard',
        ]);

        await expect(page.locator('pt-puzzle-picker .filter-size .option').first()).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(
            page.locator('pt-puzzle-picker .filter-difficulty .option').first(),
        ).toHaveAttribute('aria-pressed', 'true');

        expect(await titlesOn(page)).toHaveLength(4);
    });

    test('narrows the list and says how much of the bank is hidden', async ({ page }) => {
        await page.locator('pt-puzzle-picker .filter-size .option', { hasText: '5×5' }).click();

        expect(await titlesOn(page)).toEqual(['Warm-Up', 'Second Wind']);
        await expect(page.locator('pt-puzzle-picker .list legend')).toHaveText(
            'Choose a puzzle · 2 of 4',
        );

        // The count is feedback about a filter, so it leaves with the filter.
        await page
            .locator('pt-puzzle-picker .filter-size .option', { hasText: 'Any size' })
            .click();
        await expect(page.locator('pt-puzzle-picker .list legend')).toHaveText('Choose a puzzle');
    });

    /**
     * Disabling the pairs that match nothing is what keeps the list from ever coming up empty: an
     * option is pressable only if something is behind it *given the other filter*, so every pair a
     * host can reach holds at least one card. Greyed rather than hidden, the way a colour another
     * player holds is: a row that changes length as it is used is harder to read than a fixed one.
     */
    test('greys out a pair with nothing behind it rather than emptying the list', async ({
        page,
    }) => {
        const size = (label) =>
            page.locator('pt-puzzle-picker .filter-size .option', { hasText: label });
        const level = (label) =>
            page.locator('pt-puzzle-picker .filter-difficulty .option', { hasText: label });

        await size('5×5').click();
        await expect(level('Easy')).toBeEnabled();
        await expect(level('Medium')).toBeEnabled();
        await expect(level('Hard')).toBeDisabled();
        // Never the way back out.
        await expect(level('Any difficulty')).toBeEnabled();

        // Symmetric: with hard chosen, only the size that has a hard puzzle stays pressable.
        await size('Any size').click();
        await level('Hard').click();
        await expect(size('20×21')).toBeEnabled();
        await expect(size('5×5')).toBeDisabled();
        await expect(size('15×15')).toBeDisabled();
        expect(await titlesOn(page)).toEqual(['The Long Haul']);
    });

    /**
     * The selection cannot be left pointing at a card that is no longer on screen: that is the bug
     * where the list highlights one puzzle and Start begins a different one, which the picker already
     * had to answer once for the settings a room remembers.
     */
    test('moves the selection when the chosen puzzle is filtered away', async ({ page }) => {
        await page.locator('pt-puzzle-picker .card', { hasText: 'The Long Haul' }).click();
        expect((await resolvedSpec(page)).puzzleId).toBe('d');

        await page.locator('pt-puzzle-picker .filter-size .option', { hasText: '5×5' }).click();

        await expect(page.locator('pt-puzzle-picker .card[aria-pressed=true]')).toContainText(
            'Warm-Up',
        );
        // Polled: the selection moves in the update that follows the filter, not in the click.
        await expect.poll(async () => (await resolvedSpec(page)).puzzleId).toBe('a');

        // ...and it carries that card's own size and difficulty, never the filter's.
        const spec = await resolvedSpec(page);
        expect(spec.size).toEqual({ rows: 5, cols: 5 });
        expect(spec.difficulty).toBe('easy');
    });

    test('leaves a selection that survives the filter alone', async ({ page }) => {
        await page.locator('pt-puzzle-picker .card', { hasText: 'Second Wind' }).click();
        await page.locator('pt-puzzle-picker .filter-size .option', { hasText: '5×5' }).click();

        await expect(page.locator('pt-puzzle-picker .card[aria-pressed=true]')).toContainText(
            'Second Wind',
        );
        expect((await resolvedSpec(page)).puzzleId).toBe('b');
    });
});

test.describe('describing a generated puzzle', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
    });

    /** One of the picker's fieldsets, addressed by its legend. */
    const group = (page, legend) =>
        page.locator('pt-puzzle-picker fieldset').filter({ hasText: legend });

    /**
     * The same rule the card list obeys: what the picker submits is what it is showing.
     *
     * A grid below its type's floor cannot be rated, so the buttons grey out and the panel says the
     * grids are always easy. The spec has to follow. Otherwise picking hard at 9×9 and dropping to
     * 4×4 leaves hard in the submitted spec with no enabled button to take it back, and the server
     * spends its whole redraw budget on a band no 4×4 sudoku can have.
     */
    test('drops the difficulty to easy on a grid too small to rate', async ({ page }) => {
        const level = (label) => group(page, 'Difficulty').locator('.option', { hasText: label });

        await level('Hard').click();
        expect((await resolvedSpec(page)).difficulty).toBe('hard');

        await group(page, 'Size').locator('.option', { hasText: '4×4' }).click();

        await expect(level('Hard')).toBeDisabled();
        await expect(page.locator('pt-puzzle-picker .note')).toHaveText(
            'grids below 9×9 are always easy',
        );
        expect((await resolvedSpec(page)).difficulty).toBe('easy');

        // ...and going back up to a size that can be rated leaves easy chosen rather than restoring
        // a difficulty the host can no longer see they asked for.
        await group(page, 'Size').locator('.option', { hasText: '9×9' }).click();
        await expect(level('Easy')).toHaveAttribute('aria-pressed', 'true');
        expect((await resolvedSpec(page)).difficulty).toBe('easy');
    });
});
