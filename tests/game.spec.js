/**
 * The game screen's chrome: the keypad, the Notes toggle, the assist controls, and the way out.
 *
 * Also the app-wide styling rules that only a browser can confirm: one focus colour and one
 * control radius, both of which are distributed into every shadow root by hand and so can only be
 * checked where they land.
 */

import { expect, test } from '@playwright/test';

import { createDims, solveFirst } from '../server/puzzles/sudoku/solver.js';

import { boardOf, createRoom, firstEditableCell, startPuzzle } from './helpers.js';

/** rgb(r, g, b) as #rrggbb, so it can be compared against a token. */
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
            'pt-mode-toggle .action',
            'footer .action',
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
    });

    /**
     * Panel controls are at least as tall as a thumb, whatever their label does.
     *
     * pt-keypad .action and not .actions button: the setting is slotted, so it is a light-DOM
     * child of the panel rather than a descendant of the bar it is laid out in. The class is what
     * every one of them shares whichever side of that line it falls on.
     */
    test('every panel control clears 44px', async ({ page }) => {
        const heights = await page
            .locator('pt-keypad .action')
            .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));

        expect(heights.length).toBe(3);
        for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
    });

    test('every control focuses in the accent, in both themes', async ({ page }) => {
        const selectors = [
            'pt-keypad .digits button',
            'pt-keypad .actions button',
            'pt-mode-toggle .action',
            'footer .action',
            'pt-sudoku-board .grid',
            'pt-game .puzzle-actions button',
            // Leave room is red at rest and accent when focused: one ring, whatever the control.
            'pt-game .puzzle-actions button.danger',
        ];

        for (const theme of ['light', 'dark']) {
            if (theme === 'dark') await page.locator('footer .action').first().click();
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
        await expect(page.locator('pt-keypad .action svg.icon')).toHaveCount(3);
        await expect(page.locator('pt-mode-toggle svg.icon')).toHaveCount(1);
        // Theme, About, GitHub, Report: one bar, one icon each.
        await expect(page.locator('footer svg.icon')).toHaveCount(4);
        await expect(page.locator('pt-game .puzzle-actions button.danger svg.icon')).toHaveCount(1);

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

    /**
     * Every control in the app carries its word: the panel's under its icon, the action row's
     * beside it.
     *
     * ADR-0011 took the panel's labels off to buy vertical space and bought none: the panel's height
     * is set by the rows of keys below the button bar, so a shorter bar just left a gap. The words
     * are back, stacked under the icons, and the bar is one row because its buttons share it rather
     * than each taking the width of its own label.
     */
    test('every control carries its word', async ({ page }) => {
        // Sorted, because the slotted setting and the rendered actions come from two different
        // roots and their traversal order is Playwright's business rather than the layout's.
        const labels = await page
            .locator('pt-keypad .action-label')
            .evaluateAll((els) => els.map((el) => el.textContent.trim()).sort());
        expect(labels).toEqual(['Erase', 'Notes', 'Undo']);

        const actions = page.locator('pt-game .puzzle-actions button');
        await expect(actions).toHaveText(['Puzzle Select', 'Check', 'Reveal', 'Leave Room']);
    });

    /** The label sits under the icon, not beside it, which is what makes four fit a phone. */
    test('the panel stacks its label under its icon', async ({ page }) => {
        const box = await page
            .locator('pt-keypad .action')
            .first()
            .evaluate((el) => {
                const icon = el.querySelector('svg.icon').getBoundingClientRect();
                const label = el.querySelector('.action-label').getBoundingClientRect();
                return { iconBottom: icon.bottom, labelTop: label.top };
            });

        expect(box.labelTop).toBeGreaterThanOrEqual(box.iconBottom - 1);
    });

    /**
     * The three puzzle actions share a line; Leave room wraps below them.
     *
     * Four labelled buttons come to about 618px and the row is the board's 480px, so with a host's
     * full set they cannot fit one line, and widening the row past the grid it sits under would be
     * a worse answer than a second line. What the wrap must not do is make Leave room a different
     * *control*: it stays inside the same rule, at the same height and the same type size as the
     * three above it, which is the whole of what "same size as the other buttons" asked for. That is
     * what the next test holds.
     */
    test('the puzzle actions are one group, apart from the keys', async ({ page }) => {
        const tops = await page
            .locator('pt-game .puzzle-actions button')
            .evaluateAll((buttons) =>
                buttons.map((el) => Math.round(el.getBoundingClientRect().top)),
            );

        expect(tops.length).toBe(4);
        expect(new Set(tops.slice(0, 3)).size, 'the three puzzle actions share a row').toBe(1);
        expect(tops[3], 'Leave room wraps below them').toBeGreaterThan(tops[0]);
    });

    /** Leave room is the same control as the three above it, differing only in colour. */
    test('Leave room is sized like the actions it sits with', async ({ page }) => {
        const metrics = await page
            .locator('pt-game .puzzle-actions button')
            .evaluateAll((buttons) =>
                buttons.map((el) => {
                    const style = getComputedStyle(el);
                    return {
                        height: Math.round(el.getBoundingClientRect().height),
                        fontSize: style.fontSize,
                        padding: style.padding,
                        radius: style.borderRadius,
                    };
                }),
            );

        const [first, ...rest] = metrics;
        for (const other of rest) expect(other).toEqual(first);
    });

    /**
     * Leave room is in the row and is still marked out by colour alone, which is the one channel
     * it now has. Worth asserting precisely because it is a single channel: nothing else about the
     * button differs from the three beside it any more.
     */
    test('Leave room wears the danger accent and nothing else does', async ({ page }) => {
        const danger = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
        );

        const leave = page.locator('pt-game .puzzle-actions button.danger');
        await expect(leave).toHaveText('Leave Room');
        expect(toHex(await leave.evaluate((el) => getComputedStyle(el).color))).toBe(
            danger.toLowerCase(),
        );

        await expect(page.locator('pt-game .puzzle-actions button.danger')).toHaveCount(1);
    });

    /**
     * The panel is pinned to the bottom of the *viewport*, not laid out at the bottom of the page
     * (ADR-0010). That is the whole of what this change bought: a grid too tall for the screen can be
     * scrolled and read while the keys stay exactly where a thumb left them.
     */
    test('the input panel stays at the foot of the screen, whatever the page does', async ({
        page,
    }) => {
        const at = () =>
            page.locator('pt-keypad').evaluate((panel) => ({
                position: getComputedStyle(panel).position,
                fromBottom: Math.round(window.innerHeight - panel.getBoundingClientRect().bottom),
            }));

        expect(await at()).toEqual({ position: 'fixed', fromBottom: 0 });

        await page.mouse.wheel(0, 400);
        expect(await at()).toEqual({ position: 'fixed', fromBottom: 0 });
    });

    /**
     * ...and because it is out of the flow, the page has to make its own room for it. Without the
     * spacer the last control on the page, Leave room, sits underneath the keys at every scroll
     * position, which is to say it cannot be pressed at all.
     */
    test('nothing is stranded underneath the panel', async ({ page }) => {
        await page.mouse.wheel(0, 5000);

        // The last thing on the page is the footer's action bar, which is below the game screen
        // and so below any spacer the game screen could have reserved for itself.
        const clear = async (selector) => {
            const panel = await page.locator('pt-keypad').boundingBox();
            const box = await page.locator(selector).boundingBox();
            return Math.round(panel.y - (box.y + box.height));
        };

        await expect
            .poll(() => clear('pt-game .puzzle-actions button.danger'))
            .toBeGreaterThanOrEqual(0);
        await expect.poll(() => clear('footer .footer-actions')).toBeGreaterThanOrEqual(0);
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

        // It sits under the grid its result happened to, not down among the puzzle actions.
        const order = await page.locator('pt-game').evaluate((game) => {
            const box = (sel) => game.shadowRoot.querySelector(sel).getBoundingClientRect();
            return {
                board: box('.board').bottom,
                notice: box('.notice').top,
                actions: box('.puzzle-actions').top,
            };
        });
        expect(order.notice).toBeGreaterThanOrEqual(order.board);
        expect(order.notice).toBeLessThan(order.actions);
    });
});

test.describe('input mode', () => {
    test('Notes is a toggle, sitting above the digits it changes the meaning of', async ({
        page,
    }) => {
        await createRoom(page);
        await startPuzzle(page);

        const notes = page.locator('pt-mode-toggle .action');
        await expect(notes).toHaveAttribute('aria-pressed', 'false');
        await expect(notes).toHaveText('Notes');

        // In the panel's button bar, above the digits it changes the meaning of, and below nothing
        // else, since the bar is the top of the panel for a type with no clue to show.
        const bottomOf = async (selector) => {
            const box = await page.locator(selector).boundingBox();
            return Math.round(box.y + box.height);
        };
        const topOf = async (selector) =>
            Math.round((await page.locator(selector).boundingBox()).y);

        // .action, not the host: <pt-mode-toggle> is display: contents so its button can share
        // the bar's row directly, which means the host element itself has no box to measure.
        const mode = await bottomOf('pt-mode-toggle .action');
        expect(mode).toBeLessThanOrEqual(await topOf('pt-keypad .digits'));
        expect(mode).toBeGreaterThan(await topOf('pt-keypad'));
    });

    /**
     * The pressed state moves four channels, not one.
     *
     * The switch this replaced showed its state by sliding a knob, which is a shape change and so
     * survives being seen without colour. An aria-pressed button has no knob, so the border *and*
     * the ground both have to move: one of them alone would be a hue difference and nothing else,
     * which is what the grayscale check exists to catch (brand.md §3).
     *
     * The icon filling and the label thickening are the two that are shape rather than paint, and
     * they are what a stuck hover border cannot counterfeit, which is the whole reason they exist.
     */
    test('flips all four channels and writes a pencil mark', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const notes = page.locator('pt-mode-toggle .action');
        const paint = () =>
            notes.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                    border: style.borderTopColor,
                    background: style.backgroundColor,
                    iconFill: getComputedStyle(el.querySelector('.icon')).fill,
                    iconStroke: getComputedStyle(el.querySelector('.icon')).stroke,
                    labelWeight: getComputedStyle(el.querySelector('.action-label')).fontWeight,
                };
            });

        const before = await paint();
        expect(before.iconFill, 'the resting icon is an outline').toBe('none');
        await notes.click();
        await expect(notes).toHaveAttribute('aria-pressed', 'true');

        const after = await paint();
        expect(after.border, 'the border takes the accent').not.toBe(before.border);
        expect(after.background, 'the ground takes the accent wash').not.toBe(before.background);
        expect(after.iconFill, 'the icon fills').not.toBe('none');
        expect(after.iconStroke, 'the icon strokes in the accent').not.toBe(before.iconStroke);
        expect(Number(after.labelWeight), 'the label thickens').toBeGreaterThan(
            Number(before.labelWeight),
        );

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

/**
 * Hover is a *pointer* state, and a touch screen has no pointer.
 *
 * A touch browser emulates hover on whatever was tapped last and holds it there until something else
 * is tapped, so an ungated :hover becomes a state that outlives the tap. Here that was
 * border-color: var(--accent), an accent frame left sitting on an unfocused control, which brand
 * §4 says reads as a stuck focus ring, and which on a *setting* is a pressed button missing only its
 * wash. Every hover rule in the app is now behind @media (hover: hover).
 *
 * It was never the focus ring, and could not have been: :focus-visible does not match a touch
 * activation, and the panel's controls preventDefault() on pointerdown to keep the grid focused,
 * so they take no focus from a tap at all. That is asserted here too, because the fix would look
 * just as green if focus had quietly started landing on the keys instead.
 */
test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    test('a tap leaves no state behind on the control it landed on', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const resting = await page
            .locator('pt-keypad .digits button')
            .nth(1)
            .evaluate((el) => getComputedStyle(el).borderTopColor);
        const borderOf = (locator) => locator.evaluate((el) => getComputedStyle(el).borderTopColor);

        // The app must agree there is no hover here, or the gate below proves nothing.
        expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);

        const key = page.locator('pt-keypad .digits button').first();
        await key.tap();
        expect(await borderOf(key), 'the tapped key keeps no hover border').toBe(resting);
        expect(
            await key.evaluate((el) => el.matches(':focus-visible')),
            'and takes no focus ring either',
        ).toBe(false);

        // A setting is the case that mattered: on, then off again, with nothing left over.
        const notes = page.locator('pt-mode-toggle .action');
        await notes.tap();
        await expect(notes).toHaveAttribute('aria-pressed', 'true');
        await notes.tap();
        await expect(notes).toHaveAttribute('aria-pressed', 'false');
        expect(await borderOf(notes), 'a toggle switched back off looks switched off').toBe(
            resting,
        );
    });
});

test.describe('the footer', () => {
    /**
     * The theme control is an action, not a toggle.
     *
     * It was aria-pressed on "Dark theme" for one revision, which made it a state to be read. It
     * does one thing, so it names that thing, and the name flips with the theme, which is also what
     * settles which of the two icons to draw.
     */
    test('the theme button switches, names the switch, and remembers it', async ({ page }) => {
        await createRoom(page);

        const theme = page.locator('footer .action').first();
        await expect(theme).toHaveAttribute('aria-label', 'Switch to dark theme');
        expect(await theme.getAttribute('aria-pressed'), 'not a toggle').toBeNull();

        await expect(theme.locator('.action-label')).toHaveText('Dark');

        await theme.click();
        await expect
            .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
            .toBe('dark');
        await expect(theme).toHaveAttribute('aria-label', 'Switch to light theme');
        await expect(theme.locator('.action-label')).toHaveText('Light');
        expect(await page.evaluate(() => localStorage.getItem('pt:theme'))).toBe('dark');
    });

    /**
     * Four controls on one row, each with its word, each big enough for a thumb.
     *
     * The bar replaced two wordless squares over two links set a step smaller, so what is asserted
     * here is what that swap was for: one row, and nothing on it that has to be hovered to be
     * named. The two that leave the app are still anchors, which is the one part of the old
     * division that survived: a button changes the app, a link leaves it, and only the drawing
     * stopped saying so.
     */
    test('the footer is one bar of four labelled actions', async ({ page }) => {
        await createRoom(page);

        const actions = page.locator('footer .footer-actions > *');
        await expect(actions.locator('.action-label')).toHaveText([
            'Dark',
            'About',
            'GitHub',
            'Report',
        ]);

        const boxes = await actions.evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect()),
        );
        expect(new Set(boxes.map((box) => Math.round(box.top))).size, 'one row').toBe(1);
        for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);

        const links = await actions.evaluateAll((els) =>
            els.filter((el) => el.tagName === 'A').map((el) => el.getAttribute('target')),
        );
        expect(links, 'the two that leave are anchors, in a new tab').toEqual(['_blank', '_blank']);
    });

    /**
     * About holds the version, which is the only reason it had to exist rather than being a nice
     * idea: the footer used to say it and now nothing else does.
     */
    test('About opens, states the version, and closes', async ({ page }) => {
        await createRoom(page);

        await page.locator('footer .action').nth(1).click();
        const dialog = page.locator('pt-about dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('PuzzleTogether');
        await expect(dialog.locator('.version')).toHaveText(/^v\d+\.\d+\.\d+$/);

        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
    });
});

test.describe('how to play', () => {
    /**
     * The rules of the puzzle, opened from the caption that names it.
     *
     * The entry point is on the header and not in the puzzle-action row, because that row is
     * defined by scope: everything in it acts on the room's puzzle or on your seat in it, and help
     * acts on nothing. Both halves of that are asserted here, since the row staying at four buttons
     * is the part a later change would quietly undo.
     */
    test('opens from the header, states the rules, and closes', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        await expect(page.locator('pt-game .puzzle-actions button')).toHaveText([
            'Puzzle Select',
            'Check',
            'Reveal',
            'Leave Room',
        ]);

        const help = page.locator('pt-game .header .help');
        await expect(help).toHaveAttribute('aria-label', 'How to play Sudoku');
        await help.click();

        const dialog = page.locator('pt-help dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('h2')).toHaveText('How to play Sudoku');
        await expect(dialog.locator('.goal')).toContainText('no digit repeats');
        await expect(dialog.locator('li')).toHaveCount(3);
        // The half that is about this app rather than about sudoku: the one setting beside the keys.
        await expect(dialog.locator('.input')).toContainText('Notes');

        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
    });

    /**
     * The caption is centred on the caption, not on the caption plus its control.
     *
     * Flex centring divides the row between everything in it, so without the balancing item the
     * words sit half a control left of centre: small enough to read as nothing on one puzzle, and
     * plain as soon as the name changes length beside a grid that is centred properly.
     */
    test('the header text is centred as though the control were not there', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const centres = await page.locator('pt-game .header').evaluate((header) => {
            const centre = (el) => {
                const box = el.getBoundingClientRect();
                return box.x + box.width / 2;
            };
            return {
                header: centre(header),
                title: centre(header.querySelector('span:not(.balance)')),
            };
        });

        // A pixel of tolerance: the two engines round a half-width differently, which is the whole
        // reason this row is centred as flex items rather than aligned against a baseline.
        expect(Math.abs(centres.header - centres.title)).toBeLessThanOrEqual(1);
    });

    /** The same sentence the dialog opens with, where the host is choosing what to start. */
    test('the picker says what a type asks of a solver', async ({ page }) => {
        await createRoom(page);

        const goal = page.locator('pt-puzzle-picker .goal');
        await expect(goal).toContainText('no digit repeats');

        await page.locator('pt-puzzle-picker .option', { hasText: 'Nonogram' }).click();
        await expect(goal).toContainText('a picture comes out of the grid');
    });
});

test.describe('leaving mid-puzzle', () => {
    test('the game screen offers the same way out as Puzzle Select', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        await page.locator('pt-game .puzzle-actions button.danger').click();
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
            'pt-mode-toggle .action',
            'pt-keypad .actions button',
            'footer .action',
        ]) {
            const box = await page.locator(selector).first().boundingBox();
            expect(box.height, selector).toBeGreaterThanOrEqual(44);
        }
    });

    /**
     * The button bar is one row on the narrowest screen we support, labels and all.
     *
     * This is what the labels were removed for and what removing them turned out not to be needed
     * for: the bar wrapped because each button took the width of its own word, not because the
     * words were there. Sharing the row fixes it and keeps them.
     */
    test('the panel button bar is one row at 320px', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const tops = await page
            .locator('pt-keypad .action')
            .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));

        expect(tops.length).toBe(3);
        expect(new Set(tops).size, 'Notes, Erase, and Undo share a row').toBe(1);
        // ...and the row does not overflow the phone it is pinned to.
        const overflow = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    });
});

test.describe('given squares', () => {
    /**
     * A square the puzzle came with reads as printed rather than written: heavier, and on a faintly
     * tinted ground. Two channels, neither of them colour: attribution is what colour means here.
     */
    test('are heavier than an entry and sit on a tinted ground', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const seen = await page.locator('pt-sudoku-board pt-cell').evaluateAll((cells) => {
            const given = cells.find((cell) => cell.hasAttribute('given'));
            const empty = cells.find((cell) => !cell.hasAttribute('given'));
            const weight = (cell) => {
                const value = cell.shadowRoot.querySelector('.value');
                return value ? getComputedStyle(value).fontWeight : null;
            };
            return {
                givenWeight: weight(given),
                givenGround: getComputedStyle(given).backgroundColor,
                emptyGround: getComputedStyle(empty).backgroundColor,
            };
        });

        expect(Number(seen.givenWeight)).toBe(700);
        expect(seen.givenGround).not.toBe(seen.emptyGround);
        expect(seen.givenGround).not.toBe('rgba(0, 0, 0, 0)');
    });

    /**
     * The tint survives the cursor's wash rather than being replaced by it.
     *
     * They are background-color and background-image precisely so a given square in the cursor's
     * row shows both. As one shorthand, the tint blinked out every time anybody moved.
     */
    test('keep their tint under the cursor wash', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        const givenIndex = await page
            .locator('pt-sudoku-board pt-cell')
            .evaluateAll((cells) => cells.findIndex((cell) => cell.hasAttribute('given')));

        await page.locator(`pt-cell >> nth=${givenIndex}`).click();

        const painted = await page.locator(`pt-cell >> nth=${givenIndex}`).evaluate((cell) => {
            const style = getComputedStyle(cell);
            return { color: style.backgroundColor, image: style.backgroundImage };
        });

        expect(painted.color, 'the tint is still there').not.toBe('rgba(0, 0, 0, 0)');
        expect(painted.image, 'and the wash is over it').not.toBe('none');
    });
});

test.describe('the congrats modal', () => {
    /**
     * Every way out of the modal in one row, each with an icon.
     *
     * Driven against the element on its own rather than through a solve: reaching this modal for
     * real means finishing a puzzle, and what is being checked here is layout.
     */
    test('puts all of its buttons in one row, with icons', async ({ page }) => {
        await createRoom(page);
        await page.evaluate(() => {
            const modal = document.createElement('pt-congrats-modal');
            modal.solved = { elapsedMs: 61_000, streak: 2, assists: 0, revealed: false };
            modal.isHost = true;
            modal.settings = { type: 'sudoku', difficulty: 'easy', size: 4 };
            modal.catalog = null;
            document.body.append(modal);
        });

        const buttons = page.locator('pt-congrats-modal .buttons button');
        await expect(buttons).toHaveCount(3);
        await expect(buttons).toHaveText(['Start another', 'Puzzle Select', 'See the grid']);
        await expect(page.locator('pt-congrats-modal .buttons svg.icon')).toHaveCount(3);

        const tops = await buttons.evaluateAll((els) =>
            els.map((el) => Math.round(el.getBoundingClientRect().top)),
        );
        expect(new Set(tops).size, 'all three share a row').toBe(1);
    });

    /** It is the one modal allowed to be seen arriving. */
    test('animates in', async ({ page }) => {
        await createRoom(page);
        await page.evaluate(() => {
            const modal = document.createElement('pt-congrats-modal');
            modal.solved = { elapsedMs: 61_000, streak: 1, assists: 0, revealed: false };
            document.body.append(modal);
        });

        const animation = await page
            .locator('pt-congrats-modal dialog')
            .evaluate((el) => getComputedStyle(el).animationName);
        expect(animation).toBe('celebrate');
    });
});

/**
 * The wave of colour that crosses a finished grid before the modal opens (brand.md §5).
 *
 * Two of these need a genuinely solved puzzle, which is the one thing a client cannot arrange for
 * itself: the solution never leaves the server, and completion is decided there. So the test works
 * one out in Node from the givens the browser already has, and types it in.
 */
test.describe('the solve celebration', () => {
    /** A CSS duration in milliseconds, whichever unit the engine serialised it in. */
    function toMs(duration) {
        return duration.trim().endsWith('ms')
            ? Number.parseFloat(duration)
            : Number.parseFloat(duration) * 1000;
    }

    /**
     * Whether the grid is waving and whether the modal is open, read at one instant.
     *
     * One evaluate rather than two locators, because what is being tested is that the two never
     * overlap; sampling them a round trip apart would be sampling two different moments. It reaches
     * through the shadow roots by hand for the same reason: Playwright's engine pierces them, but
     * only one selector at a time.
     */
    function celebrationState(page) {
        return page.locator('pt-game').evaluate((game) => {
            const board = game.renderRoot.querySelector('.board')?.firstElementChild;
            const dialog = game.renderRoot
                .querySelector('pt-congrats-modal')
                ?.renderRoot?.querySelector('dialog');
            return {
                waving: board?.renderRoot?.querySelector('pt-celebration-layer') != null,
                modal: dialog?.open === true,
            };
        });
    }

    /**
     * Fills in the sudoku on screen, solved in Node from the givens the client holds.
     *
     * The generator only ships puzzles with a unique solution, so the first one the solver finds is
     * the one the server will accept.
     */
    async function solveSudoku(page) {
        const { side, givens } = await boardOf(page).evaluate((board) => ({
            side: board.doc.size.rows,
            givens: board.doc.cells.map((cell) => Number(cell.given ?? 0)),
        }));

        const solution = solveFirst(Uint8Array.from(givens), createDims(side));
        expect(solution, 'the puzzle on screen is solvable').not.toBeNull();

        for (const [idx, value] of solution.entries()) {
            if (givens[idx] !== 0) continue;
            await page.locator(`pt-cell >> nth=${idx}`).click();
            await page.keyboard.press(String(value));
        }
    }

    /**
     * The shape of the wave, driven against the layer on its own: a straight front travelling corner
     * to corner, in the colours of the people in the room.
     *
     * Every square on one anti-diagonal shares a delay and a colour, which is what makes the room's
     * palette read as bands chasing each other down the grid rather than as confetti.
     */
    test('sweeps corner to corner in the room’s colours', async ({ page }) => {
        await createRoom(page);
        await page.evaluate(() => {
            const layer = document.createElement('pt-celebration-layer');
            layer.rows = 3;
            layer.cols = 3;
            layer.cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            layer.players = [
                { id: 'a', colorIndex: 0, connected: true },
                { id: 'b', colorIndex: 3, connected: true },
                // Gone from the room, so not one of its colours.
                { id: 'c', colorIndex: 5, connected: false },
            ];
            document.body.append(layer);
        });

        const tokens = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
                sweep: style.getPropertyValue('--motion-celebrate-sweep'),
                first: style.getPropertyValue('--player-0').trim(),
                second: style.getPropertyValue('--player-3').trim(),
            };
        });

        const pulses = await page.locator('pt-celebration-layer .pulse').evaluateAll((els) =>
            els.map((el) => ({
                delay: getComputedStyle(el).animationDelay,
                color: getComputedStyle(el).backgroundColor,
            })),
        );
        expect(pulses).toHaveLength(9);

        const delay = (idx) => toMs(pulses[idx].delay);

        // The top-left square goes first and the bottom-right last, one whole sweep later.
        expect(delay(0)).toBe(0);
        expect(delay(8)).toBeCloseTo(toMs(tokens.sweep), 1);
        expect(delay(0)).toBeLessThan(delay(1));
        expect(delay(1)).toBeLessThan(delay(2));

        // A diagonal is one front: (0,1) and (1,0) are the same moment, and so are the three cells
        // of the diagonal after it.
        expect(delay(1)).toBe(delay(3));
        expect(delay(2)).toBe(delay(4));
        expect(delay(4)).toBe(delay(6));

        // Two players in the room, so two colours, alternating by diagonal; the third seat left.
        expect(toHex(pulses[0].color)).toBe(tokens.first);
        expect(toHex(pulses[1].color)).toBe(tokens.second);
        expect(toHex(pulses[4].color)).toBe(tokens.first);
        expect(new Set(pulses.map((pulse) => pulse.color)).size).toBe(2);
    });

    /**
     * The wave and the modal are one sequence, not two things happening at once: the grid says the
     * room finished, and only then does the modal say what that was worth.
     */
    test('runs before the modal, and leaves nothing behind', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);
        await solveSudoku(page);

        await expect
            .poll(() => celebrationState(page), {
                // A fixed, fast interval. The default backs off to a second between samples, which
                // is longer than the wave, so the test would time its own polling, not the app.
                intervals: [50],
                timeout: 15_000,
            })
            .toEqual({ waving: true, modal: false });

        await expect(page.locator('pt-congrats-modal dialog')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('pt-celebration-layer')).toHaveCount(0);
    });

    /**
     * A reveal is the room giving up on a puzzle, and it gets the modal it already had, no wave.
     * Celebrating it in the colours of the people who did not solve it would be the app misreading
     * the moment, and the heading it sits under says "Revealed" for exactly that reason.
     */
    test('does not run for a reveal', async ({ page }) => {
        await createRoom(page);
        await startPuzzle(page);

        await page.locator('pt-game .puzzle-actions button', { hasText: 'Reveal' }).click();
        await page.locator('pt-game pt-confirm button', { hasText: 'Reveal' }).click();

        await expect(page.locator('pt-congrats-modal dialog')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('pt-congrats-modal h2')).toHaveText('Revealed');
        await expect(page.locator('pt-celebration-layer')).toHaveCount(0);
    });

    /**
     * Under reduced motion the wave is skipped outright rather than run at 0ms.
     *
     * Collapsing the durations is what every other animation in the app does, and it is the wrong
     * answer here: the modal is held back by a timer, so a 0ms wave would leave the pause with
     * nothing happening in it. Sampled all the way to the modal opening, because "it was skipped"
     * cannot be checked after the fact: a wave that had already finished looks identical to one
     * that never ran.
     */
    test('is skipped under reduced motion', async ({ page }) => {
        await createRoom(page);
        // Emulated on the page rather than declared as a context option, which this Playwright
        // version does not apply to the media query the app actually reads. Order does not matter:
        // the query is read when the puzzle is solved, not when it is loaded.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await startPuzzle(page);
        await solveSudoku(page);

        let waved = false;
        await expect
            .poll(
                async () => {
                    const state = await celebrationState(page);
                    waved ||= state.waving;
                    return state.modal;
                },
                { intervals: [50], timeout: 15_000 },
            )
            .toBe(true);

        expect(waved, 'no wave ran at any point').toBe(false);
    });
});
