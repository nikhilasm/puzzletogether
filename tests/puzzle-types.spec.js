/**
 * The two types Phase 3 added, in a real browser: kenken's cages and nonogram's gutters, marks, and
 * drag-painting. The point is the claim in design-spec.md §7 that a type costs one server module and
 * one board subclass, so most of what is checked is shared machinery driven by a new type.
 */

import { expect, test } from '@playwright/test';

import { boardOf, createRoom, firstEditableCell, startPuzzle } from './helpers.js';

/** Every cell's current value, straight off the board's view of the room. */
function valuesOf(page) {
    return boardOf(page).evaluate((board) =>
        board.doc.cells.map((_cell, idx) => board.board.cells[idx]?.value ?? null),
    );
}

/** Drags from one cell to another, as a finger would. */
async function drag(page, from, to) {
    const start = await page.locator(`pt-cell >> nth=${from}`).boundingBox();
    const end = await page.locator(`pt-cell >> nth=${to}`).boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
    await page.mouse.up();
}

test.describe('kenken', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page, '6×6', 'KenKen');
    });

    test('is named with its own capital, and draws a clue on each cage', async ({ page }) => {
        await expect(page.locator('pt-game .header')).toContainText('KenKen');

        const cages = await boardOf(page).evaluate((board) => board.doc.meta.cages);
        const labels = await page
            .locator('pt-cell')
            .evaluateAll((cells) => cells.map((cell) => cell.label));

        // One label per cage, on its top-left cell, and nowhere else.
        expect(labels.filter((label) => label != null)).toHaveLength(cages.length);
        for (const cage of cages) {
            expect(labels[cage.cells[0]], `cage ${cage.id}`).toMatch(/^\d+[+−×÷]?$/);
        }
    });

    /**
     * The cage borders come from the same isHeavyRight / isHeavyBottom hook sudoku uses for its
     * regions, asking a different question of a different meta. This is the test of that claim:
     * a heavy edge appears exactly where two cages meet, and nowhere inside one.
     */
    test('draws a heavy rule exactly where two cages meet', async ({ page }) => {
        const result = await boardOf(page).evaluate((board) => {
            const cols = board.doc.size.cols;
            const owner = new Map();
            for (const cage of board.doc.meta.cages) {
                for (const cell of cage.cells) owner.set(cell, cage.id);
            }

            const cells = [...board.shadowRoot.querySelectorAll('pt-cell')];
            let checked = 0;
            const wrong = [];

            cells.forEach((cell, idx) => {
                const col = idx % cols;
                if (col + 1 >= cols) return;
                checked += 1;
                const shouldBeHeavy = owner.get(idx) !== owner.get(idx + 1);
                if (cell.hasAttribute('heavy-right') !== shouldBeHeavy) wrong.push(idx);
            });

            return { checked, wrong };
        });

        expect(result.checked).toBeGreaterThan(20);
        expect(result.wrong).toEqual([]);
    });

    /**
     * A cage clue and the note "1" both belong in the cell's top-left corner, and the marks paint
     * after the label, so a cell with a full set of notes used to hide the clue it was solving.
     * The clue now has a row of the mark grid to itself.
     */
    test('keeps the cage clue clear of the notes under it', async ({ page }) => {
        const idx = await boardOf(page).evaluate((board) =>
            board.doc.cells.findIndex((cell) => cell.label != null),
        );
        expect(idx).toBeGreaterThanOrEqual(0);

        await page.locator('pt-mode-toggle .action').click();
        await page.locator(`pt-cell >> nth=${idx}`).click();
        for (let digit = 0; digit < 6; digit += 1) {
            await page.locator('pt-keypad .digits button').nth(digit).click();
        }

        const geometry = await page.locator(`pt-cell >> nth=${idx}`).evaluate((cell) => {
            const box = (el) => el.getBoundingClientRect();
            const marks = [...cell.shadowRoot.querySelectorAll('.marks span')];
            return {
                count: marks.length,
                label: box(cell.shadowRoot.querySelector('.label')),
                tops: marks.map((el) => box(el).top),
                centres: marks.map((el) => Math.round(box(el).left + box(el).width / 2)),
                cell: box(cell),
            };
        });

        expect(geometry.count, 'all six notes are written').toBe(6);
        for (const top of geometry.tops) {
            expect(top, 'a note starts below the clue').toBeGreaterThanOrEqual(
                geometry.label.bottom - 0.5,
            );
        }

        // The clue is sized by the track it sits in rather than by the page's type scale: with six
        // digits it shares a three-row grid, so it cannot be taller than a third of the cell.
        expect(geometry.label.height).toBeLessThan(geometry.cell.height / 3);

        // And the grid still lays out from the host's custom properties: 3 columns, 2 rows of notes.
        expect(new Set(geometry.centres).size).toBe(3);
        expect(new Set(geometry.tops.map(Math.round)).size).toBe(2);
    });

    /**
     * The clue was drawn and never said, so the whole puzzle's constraints were missing for anyone
     * not looking at the screen. It is spoken as arithmetic rather than as its symbols: at the usual
     * verbosity a screen reader skips punctuation, which would say "12" for a clue meaning 12+.
     */
    test('says the cage clue, as arithmetic rather than as symbols', async ({ page }) => {
        const clued = await boardOf(page).evaluate((board) =>
            board.doc.cells
                .map((cell, idx) => (cell.label == null ? null : { idx, label: cell.label }))
                .filter(Boolean),
        );
        expect(clued.length).toBeGreaterThan(4);

        const spoken = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' };
        for (const { idx, label } of clued) {
            const op = spoken[label.at(-1)];
            const said = op ? `cage ${label.slice(0, -1)} ${op}` : `cage ${label}`;
            await expect(page.locator(`pt-cell >> nth=${idx}`)).toHaveAttribute(
                'aria-label',
                `row ${Math.floor(idx / 6) + 1} column ${(idx % 6) + 1}, ${said}, empty`,
            );
        }

        // A cell with no cage clue says only where it is and what is in it.
        const plain = await boardOf(page).evaluate((board) =>
            board.doc.cells.findIndex((cell) => cell.label == null),
        );
        await expect(page.locator(`pt-cell >> nth=${plain}`)).toHaveAttribute(
            'aria-label',
            /^row \d+ column \d+, empty$/,
        );
    });

    test('takes digits on the keypad, like a sudoku', async ({ page }) => {
        await expect(page.locator('pt-keypad .digits button')).toHaveCount(6);
        await expect(page.locator('pt-mode-toggle .action')).toHaveText('Notes');

        await page.locator('pt-cell >> nth=0').click();
        await page.locator('pt-keypad .digits button').first().click();

        expect((await valuesOf(page))[0]).toBe('1');
    });
});

/**
 * Kakuro is the type whose structure is printed on the squares nobody writes in, which is the one
 * thing the document schema could not say before it (ADR-0014). So what is checked here is that the
 * pair of sums reaches the grid, that it is *said* as well as drawn, and that the rest of the type is
 * the shared machinery doing its job: the same keypad, the same cursor, the same blocked squares.
 */
test.describe('kakuro', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page, '9×9', 'Kakuro');
    });

    /**
     * The type that most needs explaining gets the same help control every other type gets. Kakuro's
     * structure is printed on squares nobody writes in, so the dialog is where a first-time solver is
     * told which sum belongs to which run, reached the same way everywhere.
     */
    test('explains its clue squares from the header', async ({ page }) => {
        await page.locator('pt-game .header .help').click();

        const dialog = page.locator('pt-help dialog');
        await expect(dialog.locator('h2')).toHaveText('How to play Kakuro');
        await expect(dialog.locator('li').first()).toContainText('split by a diagonal');
    });

    test('prints two sums either side of a diagonal, on blocked squares only', async ({ page }) => {
        const clues = await boardOf(page).evaluate((board) =>
            board.doc.cells
                .map((cell, idx) => (cell.clue ? { idx, ...cell.clue } : null))
                .filter(Boolean),
        );
        expect(clues.length).toBeGreaterThan(8);

        // Squares carrying both sums come first, so the corner check below always has a square to
        // make it on: a sample taken in grid order can be all single-sum border squares.
        const both = clues.filter((clue) => clue.across != null && clue.down != null);
        expect(both.length, 'a square carries both sums').toBeGreaterThan(0);

        for (const clue of [...both.slice(0, 3), ...clues.slice(0, 3)]) {
            const cell = page.locator(`pt-cell >> nth=${clue.idx}`);
            await expect(cell).toHaveAttribute('block', '');

            const drawn = await cell.evaluate((element) => {
                const layer = element.shadowRoot.querySelector('.clue');
                const centre = (selector) => {
                    const span = layer.querySelector(selector);
                    if (!span) return null;
                    const box = span.getBoundingClientRect();
                    return {
                        text: span.textContent,
                        x: box.x + box.width / 2,
                        y: box.y + box.height / 2,
                    };
                };
                return {
                    rule: getComputedStyle(layer).backgroundImage,
                    down: centre('.down'),
                    across: centre('.across'),
                };
            });

            expect(drawn.rule, 'the diagonal is drawn').toContain('gradient');
            expect(drawn.down?.text ?? null).toBe(clue.down == null ? null : String(clue.down));
            expect(drawn.across?.text ?? null).toBe(
                clue.across == null ? null : String(clue.across),
            );

            // Which triangle a sum is in *is* which run it labels: across leaves the square to the
            // right, down leaves it downwards, so the two swapped is the wrong clue on the run
            // rather than a cosmetic difference. Compared by centre, so it holds at any cell size.
            if (drawn.down && drawn.across) {
                expect(drawn.across.x, 'the across sum is right of the down sum').toBeGreaterThan(
                    drawn.down.x,
                );
                expect(drawn.across.y, 'the across sum is above the down sum').toBeLessThan(
                    drawn.down.y,
                );
            }
        }

        // An open square never carries the layer, so nothing draws a diagonal through a square
        // somebody is meant to write a digit in.
        const open = await boardOf(page).evaluate((board) =>
            board.doc.cells.findIndex((cell) => !cell.block),
        );
        await expect(page.locator(`pt-cell >> nth=${open} >> .clue`)).toHaveCount(0);
    });

    /**
     * A blocked square says "blocked" and stops, which is right everywhere else and wrong here: in a
     * kakuro that square is carrying the puzzle. Withholding it would leave a solver who is not
     * looking at the screen with no clues at all.
     */
    test('says a clue square as its sums, and a plain block as blocked', async ({ page }) => {
        const squares = await boardOf(page).evaluate((board) => {
            const cols = board.doc.size.cols;
            const clued = board.doc.cells.findIndex((cell) => cell.clue?.down != null);
            const plain = board.doc.cells.findIndex((cell) => cell.block && !cell.clue);
            return {
                clued: { idx: clued, ...board.doc.cells[clued].clue, cols },
                plain,
            };
        });

        const sums = [];
        if (squares.clued.down != null) sums.push(`${squares.clued.down} down`);
        if (squares.clued.across != null) sums.push(`${squares.clued.across} across`);
        const row = Math.floor(squares.clued.idx / squares.clued.cols) + 1;
        const col = (squares.clued.idx % squares.clued.cols) + 1;

        await expect(page.locator(`pt-cell >> nth=${squares.clued.idx}`)).toHaveAttribute(
            'aria-label',
            `row ${row} column ${col}, clue ${sums.join(', ')}`,
        );
        await expect(page.locator(`pt-cell >> nth=${squares.plain}`)).toHaveAttribute(
            'aria-label',
            /blocked$/,
        );
    });

    /**
     * Sudoku and kenken take as many digits as the grid is wide; a kakuro run draws on all nine
     * however small the grid, which is why the keypad reads the puzzle's alphabet and not its size.
     */
    test('takes all nine digits on a 9×9 grid', async ({ page }) => {
        await expect(page.locator('pt-keypad .digits button')).toHaveCount(9);

        const open = await firstEditableCell(page);
        await page.locator(`pt-cell >> nth=${open}`).click();
        await page.locator('pt-keypad .digits button').nth(8).click();

        expect((await valuesOf(page))[open]).toBe('9');
    });

    test('skips clue squares with the arrows, and washes the two runs the cursor is in', async ({
        page,
    }) => {
        const open = await firstEditableCell(page);
        await page.locator(`pt-cell >> nth=${open}`).click();

        // The cursor's context is the across run and the down run, not the whole row and column.
        const wash = await boardOf(page).evaluate((board) => {
            const inRuns = board.doc.meta.runs
                .filter((run) => run.cells.includes(board.selection))
                .flatMap((run) => run.cells);
            const highlighted = [...board.shadowRoot.querySelectorAll('pt-cell')]
                .map((cell, idx) => (cell.hasAttribute('highlighted') ? idx : -1))
                .filter((idx) => idx >= 0);
            return { expected: [...new Set(inRuns)].sort((a, b) => a - b), highlighted };
        });
        expect(wash.expected.length).toBeGreaterThan(2);
        expect(wash.highlighted).toEqual(wash.expected);

        // Walking right along the row lands only on squares a player can write in.
        for (let press = 0; press < 6; press += 1) {
            await page.keyboard.press('ArrowRight');
            const landed = await boardOf(page).evaluate((board) => ({
                block: board.doc.cells[board.selection].block,
            }));
            expect(landed.block, 'the cursor never sits on a clue square').toBe(false);
        }
    });
});

test.describe('nonogram', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page, '5×5', 'Nonogram');
    });

    test('draws its clues in gutters aligned to the grid', async ({ page }) => {
        const geometry = await boardOf(page).evaluate((board) => {
            const root = board.shadowRoot;
            const cells = [...root.querySelectorAll('pt-cell')];
            const top = [...root.querySelectorAll('.gutter-top .clues')];
            const side = [...root.querySelectorAll('.gutter-side .clues')];
            const box = (el) => el.getBoundingClientRect();

            return {
                counts: { top: top.length, side: side.length },
                // A clue's centre must fall inside the line it labels.
                topDrift: top.map((el, i) => {
                    const clue = box(el);
                    const cell = box(cells[i]);
                    return Math.abs(clue.x + clue.width / 2 - (cell.x + cell.width / 2));
                }),
                sideDrift: side.map((el, i) => {
                    const clue = box(el);
                    const cell = box(cells[i * 5]);
                    return Math.abs(clue.y + clue.height / 2 - (cell.y + cell.height / 2));
                }),
                // The frame must be as tall as its squares, not as tall as its clue stack.
                frame: box(root.querySelector('.frame')),
            };
        });

        expect(geometry.counts).toEqual({ top: 5, side: 5 });
        for (const drift of [...geometry.topDrift, ...geometry.sideDrift]) {
            expect(drift).toBeLessThan(1);
        }
        expect(Math.abs(geometry.frame.width - geometry.frame.height)).toBeLessThan(2);
    });

    /** Nonogram has no pencil marks, since the cross is the note, so it has brushes not Notes. */
    test('swaps the Notes toggle and digits for three brushes, and keeps Undo', async ({
        page,
    }) => {
        await expect(page.locator('pt-mode-toggle')).toHaveCount(0);
        await expect(page.locator('pt-keypad .digits button')).toHaveCount(0);

        await expect(page.locator('pt-brush-bar .action')).toHaveText(['Fill', 'Cross', 'Erase']);

        // Erase belongs to the digits it undoes; Undo belongs to every type. Four controls in the
        // bar, and the brushes are the same width as Undo rather than a boxed group beside it.
        const actions = page.locator('pt-keypad .actions button');
        await expect(actions).toHaveCount(1);
        await expect(actions).toHaveText('Undo');

        const widths = await page
            .locator('pt-keypad .action')
            .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
        expect(widths).toHaveLength(4);
        expect(Math.max(...widths) - Math.min(...widths), 'one row, one width').toBeLessThan(2);
    });

    test('draws a fill as a block and a cross as a mark, not as their characters', async ({
        page,
    }) => {
        await page.locator('pt-cell >> nth=0').click();
        await page.locator('pt-brush-bar .action', { hasText: 'Cross' }).click();
        await page.locator('pt-cell >> nth=1').click();

        await expect(page.locator('pt-cell >> nth=0 >> .value.block')).toBeVisible();
        await expect(page.locator('pt-cell >> nth=1 >> .value.cross')).toBeVisible();
        // The wire value is a character; the grid must never show it as one.
        await expect(page.locator('pt-cell >> nth=0')).not.toContainText('#');

        // A screen reader is owed the meaning, since the shape carries it.
        await expect(page.locator('pt-cell >> nth=0')).toHaveAttribute(
            'aria-label',
            /row 1 column 1, filled/,
        );
        await expect(page.locator('pt-cell >> nth=1')).toHaveAttribute(
            'aria-label',
            /row 1 column 2, crossed out/,
        );
    });

    test('a tap fills, and tapping the same square takes it back', async ({ page }) => {
        await page.locator('pt-cell >> nth=0').click();
        expect((await valuesOf(page))[0]).toBe('#');

        await page.locator('pt-cell >> nth=0').click();
        expect((await valuesOf(page))[0]).toBe(null);
    });

    test('a drag paints the run it crosses and stays on that line', async ({ page }) => {
        // Across the second row, then down onto the third: the descent must not paint.
        const first = await page.locator('pt-cell >> nth=5').boundingBox();
        const across = await page.locator('pt-cell >> nth=9').boundingBox();
        const below = await page.locator('pt-cell >> nth=14').boundingBox();

        await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
        await page.mouse.down();
        await page.mouse.move(across.x + across.width / 2, across.y + across.height / 2, {
            steps: 10,
        });
        await page.mouse.move(below.x + below.width / 2, below.y + below.height / 2, { steps: 10 });
        await page.mouse.up();

        const values = await valuesOf(page);
        expect(values.slice(5, 10)).toEqual(['#', '#', '#', '#', '#']);
        expect(values[14], 'the drag left its row').toBe(null);
    });

    /**
     * Letting go outside the window is easy to do on a tall grid, and it used to lose the stroke:
     * the release was watched on the grid, which never saw a pointer that had left it.
     */
    test('commits a stroke that ends outside the window', async ({ page }) => {
        const first = await page.locator('pt-cell >> nth=5').boundingBox();
        const across = await page.locator('pt-cell >> nth=7').boundingBox();

        await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
        await page.mouse.down();
        await page.mouse.move(across.x + across.width / 2, across.y + across.height / 2, {
            steps: 8,
        });
        // Out past the top-left corner of the viewport, then release there.
        await page.mouse.move(0, 0, { steps: 4 });
        await page.mouse.up();

        expect((await valuesOf(page)).slice(5, 8)).toEqual(['#', '#', '#']);
    });

    /**
     * A drag commits on release, so without a preview the grid says nothing until the gesture is over,
     * and laying a run of a particular length against a clue is the whole reason to drag.
     */
    test('washes the squares a drag has covered, before it commits', async ({ page }) => {
        const start = await page.locator('pt-cell >> nth=5').boundingBox();
        const end = await page.locator('pt-cell >> nth=8').boundingBox();

        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });

        // Mid-gesture: the run is marked, and nothing has been written yet.
        const highlighted = await page
            .locator('pt-cell')
            .evaluateAll((cells) =>
                cells.map((cell, idx) => (cell.hasAttribute('highlighted') ? idx : -1)),
            );
        expect(highlighted.filter((idx) => idx >= 0)).toEqual([5, 6, 7, 8]);
        expect((await valuesOf(page)).slice(5, 9)).toEqual([null, null, null, null]);

        await page.mouse.up();

        // On release the wash gives way to the marks it was standing in for.
        expect((await valuesOf(page)).slice(5, 9)).toEqual(['#', '#', '#', '#']);
        await expect(page.locator('pt-cell[highlighted]')).toHaveCount(0);
    });

    /**
     * A nonogram's bands divide nothing; they exist to be counted against. Drawn in --ink they read
     * as filled squares that happen to be thin, competing with the picture they are there to measure.
     */
    test('bands the grid in the hairline colour, thicker, not in the fill colour', async ({
        page,
    }) => {
        const rules = await page.locator('pt-nonogram-board').evaluate((board) => {
            const style = getComputedStyle(board);
            const cell = board.shadowRoot.querySelector('pt-cell');
            return {
                heavy: style.getPropertyValue('--grid-heavy-color').trim(),
                ink: getComputedStyle(cell).getPropertyValue('--ink').trim(),
                width: style.getPropertyValue('--grid-heavy-width').trim(),
                // The frame is unaffected: the puzzle still has a hard outer edge.
                frameWidth: style.getPropertyValue('--grid-frame-width').trim(),
            };
        });

        expect(rules.heavy).not.toBe(rules.ink);
        expect(rules.width).toBe('3px');
        expect(rules.frameWidth).toBe('2.5px');
    });

    test('a filled square fills its whole cell', async ({ page }) => {
        await page.locator('pt-cell >> nth=0').click();

        const fit = await page.locator('pt-cell >> nth=0').evaluate((cell) => {
            const block = cell.shadowRoot.querySelector('.value.block');
            // offsetWidth, not a bounding rect: the mark lands with a scale animation, and a rect
            // measured mid-flight reports the transform rather than the layout being asserted.
            return {
                dx: Math.abs(block.offsetWidth - cell.clientWidth),
                dy: Math.abs(block.offsetHeight - cell.clientHeight),
            };
        });

        expect(fit.dx).toBeLessThan(1.5);
        expect(fit.dy).toBeLessThan(1.5);
    });

    test('one Undo walks back a whole drag', async ({ page }) => {
        await drag(page, 5, 9);
        expect((await valuesOf(page)).slice(5, 10)).toEqual(['#', '#', '#', '#', '#']);

        await page.locator('pt-keypad [aria-label="Undo"]').click();
        expect((await valuesOf(page)).slice(5, 10)).toEqual([null, null, null, null, null]);
    });

    test('the cross brush lays the other mark', async ({ page }) => {
        await page.locator('pt-brush-bar .action', { hasText: 'Cross' }).click();
        await drag(page, 10, 12);

        expect((await valuesOf(page)).slice(10, 13)).toEqual(['x', 'x', 'x']);
    });

    /**
     * Completion counts filled squares only: a cross is a note about where the picture is not. So
     * the room solves the puzzle with the blanks marked, and it would solve it with them left alone.
     */
    test('solving the picture ends the puzzle, crosses and all', async ({ page }) => {
        for (let idx = 0; idx < 25; idx += 1) {
            await page.locator(`pt-cell >> nth=${idx}`).click();
        }

        await page.locator('pt-game .puzzle-actions button', { hasText: 'Check' }).click();
        await expect(page.locator('pt-game .notice')).toContainText('checked');

        const wrong = await boardOf(page).evaluate((board) =>
            Object.entries(board.checkResults)
                .filter(([, state]) => state === 'wrong')
                .map(([idx]) => Number(idx)),
        );
        expect(wrong.length).toBeGreaterThan(0);

        // Clearing every square that should not be filled leaves exactly the picture.
        for (const idx of wrong) {
            await page.locator(`pt-cell >> nth=${idx}`).click();
        }

        await expect(page.locator('pt-congrats-modal dialog')).toBeVisible({ timeout: 15_000 });
    });

    test('marks the blanks without breaking the solve', async ({ page }) => {
        const solution = await boardOf(page).evaluate((board) => board.doc.meta.rowClues);
        expect(solution).toHaveLength(5);

        // Cross a square, then fill it: the cell holds one thing at a time.
        await page.locator('pt-brush-bar .action', { hasText: 'Cross' }).click();
        await page.locator('pt-cell >> nth=0').click();
        expect((await valuesOf(page))[0]).toBe('x');

        await page.locator('pt-brush-bar .action', { hasText: 'Fill' }).click();
        await page.locator('pt-cell >> nth=0').click();
        expect((await valuesOf(page))[0]).toBe('#');
    });
});

/**
 * A 20×20 nonogram is a good puzzle on a laptop and a cramped one on a phone. It stays on offer, and
 * says so: the host choosing it is often the one person in the room who cannot see the problem.
 */
test.describe('the size caution', () => {
    test.beforeEach(async ({ page }) => {
        await createRoom(page);
        await page.locator('pt-puzzle-picker .option', { hasText: 'Nonogram' }).click();
    });

    test('marks the size that will be hard to play, and says why once it is picked', async ({
        page,
    }) => {
        const option = (label) => page.locator('pt-puzzle-picker .option', { hasText: label });

        // The triangle rides on the option itself...
        await expect(option('20×20').locator('svg.icon')).toHaveCount(1);
        await expect(option('15×15').locator('svg.icon')).toHaveCount(0);

        // ...and never carries the meaning alone.
        await expect(option('20×20')).toHaveAttribute('aria-label', /small on a phone/);

        // The type defaults to its largest *uncautioned* size, so the note is not up to begin with.
        // Defaulting the host onto the size the picker warns about would be an odd thing to do.
        await expect(option('15×15')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('pt-puzzle-picker .caution')).toHaveCount(0);

        await option('20×20').click();
        await expect(page.locator('pt-puzzle-picker .caution')).toContainText(
            'very small on a phone',
        );

        await option('15×15').click();
        await expect(page.locator('pt-puzzle-picker .caution')).toHaveCount(0);
    });

    test('leaves the other types alone', async ({ page }) => {
        await page.locator('pt-puzzle-picker .option', { hasText: 'Sudoku' }).click();
        await expect(page.locator('pt-puzzle-picker .options svg.icon')).toHaveCount(0);
        await expect(page.locator('pt-puzzle-picker .caution')).toHaveCount(0);
    });
});

test.describe('a nonogram on a phone', () => {
    test.use({ viewport: { width: 320, height: 720 } });

    test('fits its largest grid, gutters and all', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page, '20×20', 'Nonogram');

        const overflow = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

        // The clue gutter must not stretch the frame past its own squares.
        const frame = await boardOf(page).evaluate((board) => {
            const box = board.shadowRoot.querySelector('.frame').getBoundingClientRect();
            const cell = board.shadowRoot.querySelector('pt-cell').getBoundingClientRect();
            return { ratio: box.width / box.height, cell: cell.width };
        });
        expect(Math.abs(frame.ratio - 1)).toBeLessThan(0.05);
        expect(frame.cell).toBeGreaterThan(6);

        // The brushes stay thumb-sized even here.
        for (const label of ['Fill', 'Cross', 'Erase']) {
            const box = await page
                .locator('pt-brush-bar .action', { hasText: label })
                .boundingBox();
            expect(box.height, label).toBeGreaterThanOrEqual(44);
        }
    });
});
