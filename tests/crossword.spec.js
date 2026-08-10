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

    /**
     * Re-tapping the square is now the *only* way to turn the cursor on a touch screen, because the
     * clue bar's button was given to moving between clues instead. That makes this the load-bearing
     * gesture of the whole screen rather than the convenient one it used to be.
     */
    test('tapping the selected square flips direction, and the clue bar follows', async ({
        page,
    }) => {
        await page.locator('pt-cell >> nth=1').click();
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1A');

        await page.locator('pt-cell >> nth=1').click();
        expect((await cursorOf(page)).direction).toBe('D');
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1D');
    });

    /**
     * The clue bar moves *along the direction being worked* rather than through the printed list,
     * which is what makes it different from Tab: someone reading down the Down clues means 1D then
     * 2D, and being turned round into the Acrosses is a change of task rather than a step through
     * one.
     */
    test('the clue bar walks to the next clue in the same direction', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.locator('pt-cell >> nth=1').click();
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1D');

        await page.locator('pt-clue-bar .clue').click();
        expect((await cursorOf(page)).entry).toMatchObject({ num: 2, dir: 'D' });

        // The whole direction, and then round — never across into the Acrosses.
        for (let press = 0; press < 4; press += 1) {
            await page.locator('pt-clue-bar .clue').click();
        }
        expect((await cursorOf(page)).entry).toMatchObject({ num: 1, dir: 'D' });
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

    /**
     * Typing jumps the crossings somebody has already filled in.
     *
     * With a letter in the middle of the word, the next keystroke has to land *past* it rather than
     * on top of it — the crossings are the whole point of the grid, and overwriting one to type
     * around it is the fastest way to undo a teammate's work in a room solving together.
     */
    test('typing steps over squares that are already filled', async ({ page }) => {
        // Fill the middle square of 1 Across from the crossing Down entry, then come back to it.
        await page.locator('pt-cell >> nth=2').click();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.type('X');

        // Selecting a square does not change which way the cursor points — that is the direction's
        // whole nature — so getting back to 1 Across takes a tap to select and a re-tap to turn.
        await page.locator('pt-cell >> nth=1').click();
        await page.locator('pt-cell >> nth=1').click();
        expect(await cursorOf(page)).toMatchObject({ cell: 1, direction: 'A' });

        await page.keyboard.type('C');
        // Square 2 holds a letter, so the cursor is on 3 rather than poised to overwrite it.
        expect((await cursorOf(page)).cell).toBe(3);

        await page.keyboard.type('T');
        expect((await valuesOf(page)).slice(1, 4)).toEqual(['C', 'X', 'T']);
    });

    /**
     * The letters come from a pad of ours again, and the pad is the *same input path* as the
     * keyboard: a tapped key and a pressed key reach the store through one method (ADR-0010).
     *
     * The two assertions after the letter are the ones that matter. The cursor advancing proves the
     * tap went through the board's own advance rule rather than around it, and the grid still holding
     * focus proves the pad does not steal it — which is what would silently kill every arrow key and
     * every physical keystroke after the first tap.
     */
    test('a key on the pad types into the grid without taking focus off it', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.locator('pt-keypad .letters button', { hasText: 'C' }).click();

        expect((await valuesOf(page))[1]).toBe('C');
        expect((await cursorOf(page)).cell).toBe(2);

        const focused = await boardOf(page).evaluate(
            (board) => board.shadowRoot.activeElement?.className ?? null,
        );
        expect(focused).toBe('grid');

        // ...so the keyboard still reaches the grid straight afterwards, with no tap in between.
        await page.keyboard.type('A');
        expect((await valuesOf(page))[2]).toBe('A');
    });

    /**
     * The pad's own Backspace, which is the only way to delete on a touch screen now that there is no
     * platform keyboard to borrow one from.
     *
     * It is the *same* act as the keyboard's, not a second implementation of it — clear the square
     * and step back along the entry — which is why it asks the board rather than the store.
     */
    test('the pad has a Backspace, and it walks back through the entry', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('CAT');

        const backspace = page.locator('pt-keypad [aria-label="Backspace"]');
        await backspace.click();
        expect((await valuesOf(page))[3]).toBeNull();
        expect((await cursorOf(page)).cell).toBe(2);

        await backspace.click();
        await backspace.click();
        expect((await valuesOf(page)).slice(1, 4)).toEqual([null, null, null]);
        // And it stops at the entry's first square rather than reversing into another clue.
        await backspace.click();
        expect(await cursorOf(page)).toMatchObject({ cell: 1, entry: { num: 1, dir: 'A' } });
    });

    /**
     * Crossword's button bar: Clues, Rebus, Backspace, Undo — one row, in that order.
     *
     * Clues leads because it is the only one that does not act on the square you are on; it opens
     * the puzzle's other half. Backspace has moved off the bottom letter row and up here, where the
     * other controls that clear a square already were — a phone keyboard's ⌫ is a key among keys and
     * ours is not, and having it in the corner of the pad was borrowing a shape without the reason
     * for it.
     */
    test('the button bar is Clues, Rebus, Undo, Backspace, in one row', async ({ page }) => {
        const bar = page.locator('pt-keypad .action');
        await expect(bar).toHaveCount(4);

        const seen = await bar.evaluateAll((els) =>
            els.map((el) => ({
                label: el.querySelector('.action-label').textContent.trim(),
                top: Math.round(el.getBoundingClientRect().top),
                left: Math.round(el.getBoundingClientRect().left),
            })),
        );

        expect(new Set(seen.map((one) => one.top)).size, 'one row').toBe(1);
        expect(seen.sort((a, b) => a.left - b.left).map((one) => one.label)).toEqual([
            'Clues',
            'Rebus',
            'Undo',
            'Backspace',
        ]);

        // Backspace is no longer among the letters.
        await expect(page.locator('pt-keypad .letters [aria-label="Backspace"]')).toHaveCount(0);
    });

    /**
     * The keys are QWERTY, in three staggered rows, because that is the arrangement a solver's thumbs
     * already know from every phone they have ever held — which is the one thing a pad of ours can
     * borrow from the keyboard it replaces (ADR-0010).
     */
    test('the letter keys are laid out like a keyboard', async ({ page }) => {
        const rows = await page
            .locator('pt-keypad .row')
            .evaluateAll((elements) =>
                elements.map((row) =>
                    [...row.querySelectorAll('button')].map((key) => key.textContent.trim()),
                ),
            );

        expect(rows).toHaveLength(3);
        expect(rows[0].join('')).toBe('QWERTYUIOP');
        expect(rows[1].join('')).toBe('ASDFGHJKL');
        // Letters only: Backspace moved up to the button bar with the other controls that act on a
        // square rather than putting something in it.
        expect(rows[2].join('')).toBe('ZXCVBNM');
    });

    /**
     * Every key the same width, and every row centred against the ten-key row above.
     *
     * Neither was true. The rows were a twenty-half-column grid, and `grid-column: span 2` followed
     * by `grid-column-start: 2` on the first key of rows two and three left the end at `auto` — so A
     * and Z came out a single column wide, visibly narrower than every other key. And a short row
     * could only be left-aligned in the grid, which the bottom row made obvious once Backspace left
     * it.
     */
    test('the letter keys are all one width, and the short rows are centred', async ({ page }) => {
        const rows = await page.locator('pt-keypad .row').evaluateAll((elements) =>
            elements.map((row) => {
                const keys = [...row.querySelectorAll('button')];
                const box = row.getBoundingClientRect();
                return {
                    keys: keys.map((key) => ({
                        label: key.textContent.trim(),
                        width: key.getBoundingClientRect().width,
                    })),
                    keyCentre:
                        (keys[0].getBoundingClientRect().left +
                            keys.at(-1).getBoundingClientRect().right) /
                        2,
                    rowCentre: box.left + box.width / 2,
                };
            }),
        );

        const keys = rows.flatMap((row) => row.keys);
        const widths = keys.map((key) => key.width);
        expect(Math.max(...widths) - Math.min(...widths), 'one width').toBeLessThan(1.5);

        // A and Z specifically, since they are the two the old rule got wrong.
        for (const label of ['A', 'Z']) {
            const key = keys.find((one) => one.label === label);
            expect(Math.abs(key.width - Math.max(...widths)), label).toBeLessThan(1.5);
        }

        for (const row of rows) {
            expect(Math.abs(row.keyCentre - row.rowCentre), 'centred row').toBeLessThan(1.5);
        }
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
     * Backspace takes the letter out **and** steps back, so a held key walks a wrong answer out of
     * the grid a square at a time. It used to clear in place and only move once the square was
     * already empty, which meant deleting a three-letter word took six presses.
     */
    test('Backspace clears the square and steps back through the entry', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('CAT');
        expect((await cursorOf(page)).cell).toBe(3);

        await page.keyboard.press('Backspace');
        expect((await valuesOf(page))[3]).toBeNull();
        expect((await cursorOf(page)).cell).toBe(2);

        await page.keyboard.press('Backspace');
        expect((await valuesOf(page))[2]).toBeNull();
        expect((await cursorOf(page)).cell).toBe(1);
    });

    /**
     * And it stops at the start of the entry rather than reversing into whatever came before it in
     * the clue list. A cursor that leaves the clue you are reading, without being asked to, is how a
     * solver loses their place.
     */
    test('Backspace never leaves the entry it is in', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('C');
        expect((await cursorOf(page)).cell).toBe(2);

        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        expect((await cursorOf(page)).cell).toBe(1);

        // Held down at the first square: it empties it and then has nowhere to go.
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        expect(await cursorOf(page)).toMatchObject({ cell: 1, entry: { num: 1, dir: 'A' } });
        expect((await valuesOf(page))[1]).toBeNull();
    });

    /**
     * The cursor has to be findable inside a highlighted run of squares, which after the first
     * playtest it was not: the two washes were 34% and 30% of the same accent, a difference nobody
     * can see. Asserted as a ratio rather than a colour so the dark theme and any later retune stay
     * within it — what matters is that one reads as a position and the other as context.
     */
    test('the cursor is plainly stronger than the rest of its entry', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();

        const alpha = (index) =>
            page
                .locator(`pt-cell >> nth=${index}`)
                .evaluate((cell) =>
                    Number(
                        getComputedStyle(cell).backgroundColor.match(/[\d.]+(?=\))/)?.[0] ?? '1',
                    ),
                );

        const cursor = await alpha(1);
        const entry = await alpha(2);
        expect(cursor).toBeGreaterThan(entry * 3);
    });

    /**
     * The clue dialog's own layout, which had four things wrong with it at once.
     *
     * The worst was invisible in the source: both the head and the columns were padded with
     * `var(--space-5)`, and the scale has no `--space-5` — it runs 1, 2, 3, 4, 6, 8, 12. An
     * undefined custom property with no fallback makes the whole declaration invalid at
     * computed-value time, so `padding` fell back to its initial `0` and the dialog had no inset at
     * all. Nothing warns about this; the property simply is not there.
     */
    test('the clue dialog is evenly padded, unruled, and vertically centred', async ({ page }) => {
        await page.locator('pt-cell >> nth=1').click();
        await page.locator('pt-keypad [aria-label="All clues"]').click();

        const dialog = page.locator('pt-clue-list dialog');
        await expect(dialog).toBeVisible();

        const layout = await dialog.evaluate((el) => {
            const root = el.getRootNode();
            const px = (value) => Number.parseFloat(value);
            const head = root.querySelector('.head');
            const lists = root.querySelector('.lists');
            const column = root.querySelector('.column');
            const close = root.querySelector('.close');
            const button = root.querySelector('li button');
            const num = button.querySelector('.num');
            return {
                headLeft: px(getComputedStyle(head).paddingLeft),
                listsLeft: px(getComputedStyle(lists).paddingLeft),
                headBorder: getComputedStyle(head).borderBottomWidth,
                columnBorder: getComputedStyle(column).borderLeftWidth,
                closeBorder: getComputedStyle(close).borderTopWidth,
                buttonHeight: button.getBoundingClientRect().height,
                numBox: num.getBoundingClientRect(),
                buttonBox: button.getBoundingClientRect(),
            };
        });

        // One inset, shared: the heading and the clues start on the same left edge.
        expect(layout.headLeft).toBeGreaterThan(0);
        expect(layout.listsLeft).toBe(layout.headLeft);

        // No separating rules — not under the head, not between the columns, not round the close.
        expect(layout.headBorder).toBe('0px');
        expect(layout.columnBorder).toBe('0px');
        expect(layout.closeBorder).toBe('0px');

        // A one-line clue's text is centred in its row rather than sitting at the top of it.
        const numCentre = layout.numBox.top + layout.numBox.height / 2;
        const rowCentre = layout.buttonBox.top + layout.buttonBox.height / 2;
        expect(Math.abs(numCentre - rowCentre)).toBeLessThan(layout.buttonHeight / 4);
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
        await page.locator('pt-keypad [aria-label="All clues"]').click();

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
        await page.locator('pt-clue-bar').waitFor();
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

    /**
     * A solved grid is still a grid people read back — whose word was that, what was 4 Down — and
     * every way of moving around it has to keep working after the last letter lands. Only *writing*
     * stops.
     *
     * Worth a browser test rather than a unit one because the bug it guards was three separate
     * controls going quiet at once, each for the same reason: an `interactive` flag that meant "the
     * room is still taking input" being read as "this control does anything at all".
     */
    test('a finished grid can still be navigated, but not typed into', async ({ page }) => {
        const id = await boardOf(page).evaluate((board) => board.doc.id);
        const { solution } = JSON.parse(readFileSync(`${BANK}/${id}.json`, 'utf8'));

        // Typed square by square rather than word by word, so no assumption about where the cursor
        // lands after a letter is baked into the solve.
        for (const [idx, letter] of solution.entries()) {
            if (letter == null) continue;
            await page.locator(`pt-cell >> nth=${idx}`).click();
            await page.keyboard.press(`Key${letter}`);
        }

        const modal = page.locator('pt-congrats-modal dialog');
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await modal.locator('button', { hasText: 'See the grid' }).click();
        await expect(modal).toBeHidden();

        // Tapping a square still moves the cursor.
        await page.locator('pt-cell >> nth=1').click();
        expect((await cursorOf(page)).cell).toBe(1);

        /*
         * Arrows still steer, and this one also settles which way the cursor points — Up in the top
         * row can only turn it, never move it, so the cursor faces Down afterwards whichever way the
         * solve happened to leave it.
         */
        await page.keyboard.press('ArrowUp');
        expect(await cursorOf(page)).toMatchObject({ cell: 1, direction: 'D' });
        await expect(page.locator('pt-clue-bar .num')).toHaveText('1D');

        // Re-tapping still turns it, which on a touch screen is the only way to turn it at all.
        await page.locator('pt-cell >> nth=1').click();
        expect((await cursorOf(page)).direction).toBe('A');

        // And so do the other keys that only move: Space turns, Tab changes entry.
        await page.keyboard.press('Space');
        expect((await cursorOf(page)).direction).toBe('D');
        await page.keyboard.press('Space');
        await page.keyboard.press('ArrowRight');
        expect((await cursorOf(page)).cell).toBe(2);
        await page.keyboard.press('Tab');
        expect((await cursorOf(page)).entry).toMatchObject({ num: 1, dir: 'D' });

        // And the clue bar, which is the only way to walk the clues on a phone.
        await page.locator('pt-clue-bar .clue').click();
        expect((await cursorOf(page)).entry).toMatchObject({ num: 2, dir: 'D' });

        // Writing is what stopped. The grid keeps the answer it was solved with.
        const before = await valuesOf(page);
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.press('KeyQ');
        await page.keyboard.press('Backspace');
        expect(await valuesOf(page)).toEqual(before);
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
     * Rebus is a toggle in the panel's button bar, sitting where Notes and the brushes sit in the
     * other types — every type's one setting in the same place (design-spec.md §4).
     *
     * It is the *only* way to a rebus square on a touch screen: Shift is the desktop path, and a pad
     * of ours has no Shift key to offer. That is why it has to hold its state visibly rather than
     * being a press-and-forget button — which is what `aria-pressed` and the accent wash are for.
     */
    async function turnOnRebus(page) {
        const rebus = page.locator('pt-keypad .action', { hasText: 'Rebus' });
        await expect(rebus).toHaveAttribute('aria-pressed', 'false');
        await rebus.click();
        await expect(rebus).toHaveAttribute('aria-pressed', 'true');
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

    /**
     * A long rebus is clipped by its square and never widens it.
     *
     * Past about five characters the font-size hits its floor and the string is wider than the cell.
     * It was supposed to clip — `overflow: hidden` and `max-width: 100%` were both already there —
     * but the value is a flex item, and a flex item's `min-width` defaults to its min-content width,
     * which for unbreakable text is the whole string. `min-width` beats `max-width`, so the span
     * pushed its cell wider than every other cell and bent the entire grid: at eight characters the
     * row visibly stepped out and every column crossing it went with it.
     *
     * Measured against the grid rather than against the cell, because that is where it showed.
     */
    test('a long rebus never widens its square or bends the grid', async ({ page }) => {
        const rowGeometry = () =>
            page.locator('pt-crossword-board').evaluate((board) => {
                const cells = [...board.shadowRoot.querySelectorAll('pt-cell')];
                const cols = board.doc.size.cols;
                const widths = cells.map((cell) => cell.getBoundingClientRect().width);
                const lefts = cells
                    .filter((_cell, idx) => idx % cols === 0)
                    .map((cell) => Math.round(cell.getBoundingClientRect().left));
                return {
                    spread: Math.max(...widths) - Math.min(...widths),
                    // Every row starts at the same x, or the grid is not a grid.
                    leftEdges: new Set(lefts).size,
                    gridWidth: Math.round(board.shadowRoot.querySelector('.grid').scrollWidth),
                    frameWidth: Math.round(
                        board.shadowRoot.querySelector('.grid').getBoundingClientRect().width,
                    ),
                };
            });

        const before = await rowGeometry();

        await turnOnRebus(page);
        await page.locator('pt-cell >> nth=1').click();
        await page.keyboard.type('ABCDEFGH');
        expect((await valuesOf(page))[1]).toBe('ABCDEFGH');

        const after = await rowGeometry();

        expect(after.spread, 'every cell is still the same width').toBeLessThan(1.5);
        expect(after.leftEdges, 'every row still starts at the same x').toBe(1);
        expect(after.gridWidth, 'the grid did not grow').toBeLessThanOrEqual(after.frameWidth + 1);
        expect(Math.abs(after.frameWidth - before.frameWidth)).toBeLessThan(1.5);
    });
});
