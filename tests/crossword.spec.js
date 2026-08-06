/**
 * Crossword in a real browser: the black squares, the cursor's *direction*, and the clue UI.
 *
 * Direction is what this file mostly exercises, because it is the thing crossword adds that no
 * other type has and no unit test can see — a cursor that is somewhere *and pointing*, moved by
 * rules that only feel right or wrong under a real keyboard and a real click.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { boardOf, createRoom, joinRoom, startPuzzle } from './helpers.js';

/** The tracked bank, which the tests may read because the seed minis are ours and committed. */
const BANK = fileURLToPath(new URL('../data/crosswords', import.meta.url));

/** The board's own view of where the cursor is and which way it faces. */
function cursorOf(page) {
    return boardOf(page).evaluate((board) => ({
        cell: board.selection,
        direction: board.direction,
        entry: board.currentEntry
            ? { num: board.currentEntry.num, dir: board.currentEntry.dir }
            : null,
    }));
}

/** Every cell's current value, straight off the board's view of the room. */
function valuesOf(page) {
    return boardOf(page).evaluate((board) =>
        board.doc.cells.map((_cell, idx) => board.board.cells[idx]?.value ?? null),
    );
}

test.describe('crossword', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page, '5×5', 'Crossword');
    });

    /**
     * The bank is the other half of ADR-0004, and this is the only test that sees it end to end: a
     * puzzle written by a person, converted by the importer, validated at boot, and served.
     */
    test('serves a banked puzzle with clues and black squares', async ({ page }) => {
        await expect(page.locator('pt-game .header')).toContainText('Crossword');

        const doc = await boardOf(page).evaluate((board) => ({
            blocks: board.doc.cells.filter((cell) => cell.block).length,
            entries: board.doc.meta.entries.length,
            clued: board.doc.meta.entries.every((entry) => entry.clue.length > 0),
            source: board.doc.source,
        }));

        expect(doc.blocks).toBe(4);
        expect(doc.entries).toBe(10);
        expect(doc.clued).toBe(true);
        expect(doc.source).toBe('bank');
    });

    /**
     * A black square holds nothing and can hold nothing, so putting the cursor on it could only
     * ever be a dead end. This is a `<pt-board>` change rather than a crossword one — no other type
     * has block cells, which is exactly why it went untested until now.
     */
    test('never puts the cursor on a black square', async ({ page }) => {
        const firstBlock = await boardOf(page).evaluate((board) =>
            board.doc.cells.findIndex((cell) => cell.block),
        );

        await page.locator(`pt-cell >> nth=${firstBlock}`).click();
        expect((await cursorOf(page)).cell).toBeNull();

        // And arrowing across one skips it rather than stopping: cell 1 is the top-left open square,
        // and pressing Left from it must not land on the block at cell 0.
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.press('ArrowLeft');
        expect((await cursorOf(page)).cell).toBe(1);
    });

    test('numbers the squares that start an entry, and only those', async ({ page }) => {
        const labels = await page
            .locator('pt-cell')
            .evaluateAll((cells) => cells.map((cell) => cell.label));

        // The corner-blocked 5×5 always numbers exactly these squares, 1 through 8.
        expect(
            labels.map((label, idx) => (label == null ? null : `${idx}:${label}`)).filter(Boolean),
        ).toEqual(['1:1', '2:2', '3:3', '5:4', '9:5', '10:6', '15:7', '21:8']);
    });

    /**
     * The rule every solver relies on and nobody states: an arrow *across* the direction you are
     * working turns the cursor and leaves it where it is. Only once it already points that way does
     * it move. Getting this wrong is instantly infuriating and invisible to any unit test.
     */
    test('an arrow across the direction turns the cursor rather than moving it', async ({
        page,
    }) => {
        await page.locator('pt-cell >> nth=1').click();
        expect(await cursorOf(page)).toMatchObject({ cell: 1, direction: 'A' });

        await page.keyboard.press('ArrowDown');
        expect(await cursorOf(page)).toMatchObject({ cell: 1, direction: 'D' });

        // Now it points that way, so the same key moves.
        await page.keyboard.press('ArrowDown');
        expect(await cursorOf(page)).toMatchObject({ cell: 6, direction: 'D' });
    });

    test('tapping the selected square flips direction, and the clue bar follows', async ({
        page,
    }) => {
        await page.locator('pt-cell >> nth=1').click();
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1 Across');

        await page.locator('pt-cell >> nth=1').click();
        expect((await cursorOf(page)).direction).toBe('D');
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1 Down');

        // The bar is itself the toggle, which is the whole reason it is a button.
        await page.locator('pt-clue-bar .clue').click();
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1 Across');
    });

    /**
     * Typing runs along the entry and **stops at its end** rather than spilling into the next one.
     * Filling the last square of a word is a moment to look up, not to be moved somewhere
     * unannounced.
     */
    test('typing advances along the entry and stops at its end', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('CAT');

        expect((await valuesOf(page)).slice(1, 4)).toEqual(['C', 'A', 'T']);
        // 1 Across is three squares; the cursor stays on the last rather than running on.
        expect((await cursorOf(page)).cell).toBe(3);
    });

    test('the letter pad writes the same letters the keyboard does', async ({ page }) => {
        const key = (letter) =>
            page.locator('pt-letter-pad').getByRole('button', { name: letter, exact: true });

        await page.locator('pt-cell >> nth=1').click();
        await key('C').click();
        await key('A').click();

        expect((await valuesOf(page)).slice(1, 3)).toEqual(['C', 'A']);
        // It advances exactly as the keyboard does, which is the point of one input path.
        expect((await cursorOf(page)).cell).toBe(3);
    });

    test('Tab moves to the next entry and lands on an empty square', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        expect((await cursorOf(page)).entry).toMatchObject({ num: 1, dir: 'A' });

        await page.keyboard.press('Tab');
        expect((await cursorOf(page)).entry).toMatchObject({ num: 1, dir: 'D' });

        await page.keyboard.press('Shift+Tab');
        expect((await cursorOf(page)).entry).toMatchObject({ num: 1, dir: 'A' });
    });

    /**
     * Backspace on an empty square steps back and clears what it lands on, so holding it walks a
     * wrong answer out of the grid. Deleting nothing, repeatedly, is not what anybody means.
     */
    test('Backspace walks back through what was typed', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('CAT');

        await page.keyboard.press('Backspace');
        expect((await valuesOf(page))[3]).toBeNull();

        await page.keyboard.press('Backspace');
        expect((await valuesOf(page))[2]).toBeNull();
        expect((await cursorOf(page)).cell).toBe(2);
    });

    /**
     * Addressed by position rather than by clue text on purpose: the bank holds several minis and
     * hands back whichever it likes, so a test naming one of their clues would pass or fail on the
     * draw. The *shape* is shared — every mini is the corner-blocked 5×5 — so the last Across entry
     * is always 8A along the bottom row, starting at cell 21.
     */
    test('the clue list opens, marks where you are, and moves you when picked', async ({
        page,
    }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.locator('pt-clue-bar .list').click();

        const dialog = page.locator('pt-clue-list dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[aria-current=true]')).toHaveCount(1);
        // Both directions are listed, under their own headings.
        await expect(dialog.locator('h3')).toHaveText(['Across', 'Down']);
        await expect(dialog.locator('.column').first().locator('li')).toHaveCount(5);

        await dialog.locator('.column').first().locator('li button').last().click();
        await expect(dialog).toBeHidden();
        expect(await cursorOf(page)).toMatchObject({ cell: 21, direction: 'A' });
    });

    /**
     * A square says which entries *start* in it, because the bare number tells a screen-reader user
     * nothing about which clue solves the square they are on — and the direction is a property of
     * their cursor rather than of the cell.
     */
    test('a numbered square says what starts there', async ({ page }) => {
        await expect(page.locator('pt-cell >> nth=1')).toHaveAttribute(
            'aria-label',
            'row 1 column 2, starts 1 across and down, empty',
        );
        // Cell 10 begins an Across entry only, so it says so and nothing more.
        await expect(page.locator('pt-cell >> nth=10')).toHaveAttribute(
            'aria-label',
            'row 3 column 1, starts 6 across, empty',
        );
        await expect(page.locator('pt-cell >> nth=0')).toHaveAttribute(
            'aria-label',
            'row 1 column 1, blocked',
        );
    });

    /**
     * The standing check from design-spec.md's Verification list, automated for the first time here
     * rather than done by eye in devtools.
     *
     * "The solution never leaves the server" is the load-bearing claim behind Check, Reveal, and
     * server-verified completion (§6), and a bank is the one supply where the whole answer sits in a
     * file that something could serialise wholesale by accident. The answers are read from the
     * tracked bank — which the tests may do, because the seed minis are ours and committed — and
     * every frame the browser receives is searched for them.
     */
    test('no socket frame carries a solution letter before the puzzle is solved', async ({
        page,
    }) => {
        const id = await boardOf(page).evaluate((board) => board.doc.id);
        const { solution } = JSON.parse(readFileSync(`${BANK}/${id}.json`, 'utf8'));
        // The five-letter answers: long enough that a chance match inside a uuid is not credible.
        const answers = await boardOf(page).evaluate(
            (board) =>
                board.doc.meta.entries
                    .filter((entry) => entry.len === 5)
                    .map((entry) => entry.cells),
            null,
        );
        const words = answers.map((cells) => cells.map((cell) => solution[cell]).join(''));
        expect(words.length).toBeGreaterThan(4);

        const frames = [];
        page.on('websocket', (ws) => ws.on('framereceived', (f) => frames.push(String(f.payload))));

        // Reload so every frame of a fresh join, including the snapshot, is observed.
        await page.reload();
        await page.locator('pt-letter-pad').waitFor();
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.press('KeyQ');
        await expect.poll(() => frames.length).toBeGreaterThan(2);

        // Reduced to just its capitals before searching, because a solution does not travel as a
        // word — it would travel as `["C","L","O","S","E"]`, one cell at a time, which a search for
        // the contiguous string would sail straight past. Clue text survives as its initials only,
        // so it cannot manufacture a match.
        const capitals = frames.map((frame) => frame.replace(/[^A-Z]/g, ''));
        for (const word of words) {
            expect(capitals.find((frame) => frame.includes(word)) ?? '', word).toBe('');
        }
    });

    test('two players see each other typing into the same grid', async ({ page, browser }) => {
        const code = await page.evaluate(() => window.location.hash.split('/').pop());
        const other = await browser.newPage();
        await joinRoom(other, 'Grace', code);

        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('CAT');

        await expect.poll(async () => (await valuesOf(other)).slice(1, 4)).toEqual(['C', 'A', 'T']);
        await other.close();
    });
});

test.describe('crossword rebus', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page, '5×5', 'Crossword');
    });

    /**
     * The whole of ADR-0007 in one check: with Rebus on, a square holds a word, and it gets there as
     * an ordinary `set` op carrying the whole value rather than as any new kind of edit.
     */
    /**
     * The switch is set *before* the square is chosen, which is both the natural order and the
     * necessary one — pressing it takes keyboard focus, exactly as the Notes switch has always
     * done, so the grid has to be clicked into afterwards. Shift is the path that avoids the trip.
     */
    async function turnOnRebus(page) {
        // Scoped to the game screen: the footer carries a Dark theme switch of the same element.
        const rebus = page.locator('pt-game pt-switch button');
        await rebus.click();
        await expect(rebus).toHaveAttribute('aria-checked', 'true');
    }

    test('holds a whole word in one square when Rebus is on', async ({ page }) => {
        await turnOnRebus(page);
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('HAND');

        expect((await valuesOf(page))[1]).toBe('HAND');
        // Building a word keeps the cursor: advancing per letter would scatter it along the entry.
        expect((await cursorOf(page)).cell).toBe(1);
    });

    test('Shift is the physical-keyboard equivalent of the switch', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.down('Shift');
        await page.keyboard.press('KeyO');
        await page.keyboard.press('KeyN');
        await page.keyboard.press('KeyE');
        await page.keyboard.up('Shift');

        expect((await valuesOf(page))[1]).toBe('ONE');
        // A plain letter would have advanced; a held Shift is what keeps all three in one square.
        expect((await cursorOf(page)).cell).toBe(1);
    });

    test('the value shrinks to fit the square as it lengthens', async ({ page }) => {
        const sizeOf = () =>
            page
                .locator('pt-cell >> nth=1')
                .evaluate((cell) =>
                    Number.parseFloat(
                        getComputedStyle(cell.shadowRoot.querySelector('.value')).fontSize,
                    ),
                );

        await turnOnRebus(page);
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('H');
        const single = await sizeOf();

        await page.keyboard.type('AND');
        const word = await sizeOf();

        expect(word).toBeLessThan(single);
        // But it stops shrinking rather than vanishing — the floor in <pt-cell>.
        expect(word).toBeGreaterThan(single * 0.35);
    });

    test('Backspace peels one letter off a rebus rather than clearing it', async ({ page }) => {
        await turnOnRebus(page);
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('HAND');

        await page.keyboard.press('Backspace');
        expect((await valuesOf(page))[1]).toBe('HAN');
    });
});
