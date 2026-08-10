/**
 * Shared control styling — the focus ring, buttons, inputs, and the loading line.
 *
 * A `css` fragment rather than a global stylesheet, so it composes into each component's
 * `static styles` and stays inside their shadow roots (code-style.md §9).
 */

import { css } from 'lit';

/**
 * The one focus ring in the app.
 *
 * It has to be repeated into every shadow root that holds something focusable: the rule in
 * `base.css` reaches the light DOM only, so a component that omits this silently falls back to the
 * browser's own ring and the app ends up with two different focus colours. Compose this — or
 * `controls`, which includes it — wherever anything can take focus.
 */
export const focusRing = css`
    :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
`;

export const controls = css`
    ${focusRing}

    button {
        padding: var(--space-2) var(--space-6);
        border: var(--border);
        border-radius: var(--radius-control);
        background: var(--paper-raised);
        color: var(--ink);
        font-family: var(--font-ui);
        font-size: var(--text-base);
        cursor: pointer;
    }

    button:hover:not(:disabled) {
        border-color: var(--accent);
    }

    button:disabled {
        color: var(--graphite);
        cursor: default;
    }

    input {
        padding: var(--space-2) var(--space-4);
        border: var(--border);
        border-radius: var(--radius-control);
        background: var(--paper-raised);
        color: var(--ink);
        font-family: var(--font-ui);
        font-size: var(--text-base);
    }

    label {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-sm);
        color: var(--graphite);
        text-align: left;
    }

    .waiting {
        font-style: italic;
        color: var(--graphite);
    }

    .error {
        color: var(--wrong);
        font-size: var(--text-sm);
    }
`;

/**
 * A control in the input panel: an icon over a one-word label, and the pressed state a toggle draws
 * on top of it.
 *
 * One fragment for both because they are one control — `.action` is the box, and adding
 * `aria-pressed` is what makes it a setting rather than an action. That is the whole of the
 * difference in the markup and the whole of the difference on screen.
 *
 * **The label is under the icon, not beside it.** Side by side, four of these come to about 330px
 * and the narrowest screen we support has 296px to give — the row would wrap, which is the thing
 * the panel cannot afford. Stacked, the same four fit in 236px and the button gets *taller* rather
 * than wider, which it can be: the panel's height is set by the keys underneath.
 *
 * **The buttons share the row equally** (`flex: 1 1 0`), capped so they do not stretch into paddles
 * on a desktop. A row of identical boxes is also what makes the label legible at `--text-xs`: you
 * are reading a word you already half-know from the icon above it.
 *
 * **The pressed state is a border and a wash, never a fill.** The same 16% accent a selected cell
 * carries and the same treatment `optionGroup` gives a chosen option, so "this is switched on" and
 * "this is the one you picked" look alike deliberately — they are the same fact. Colour still
 * belongs to people (brand.md §3). Two channels rather than one, so the state survives the
 * grayscale check that a switch used to pass by moving a knob.
 */
export const actionButton = css`
    .action {
        display: inline-flex;
        flex: 1 1 0;
        flex-direction: column;
        gap: 1px;
        align-items: center;
        justify-content: center;
        min-width: 0;
        max-width: 7rem;
        min-height: 2.75rem;
        padding: var(--space-1) var(--space-2);
        border: var(--border);
        border-radius: var(--radius-control);
        background: var(--paper-raised);
        color: var(--graphite);
        font-family: var(--font-ui);
        cursor: pointer;
        touch-action: manipulation;
    }

    /*
     * A fixed 1rem, not iconStyle's 1.25em.
     *
     * An em-sized icon takes the font-size of whatever button it lands in, and these buttons are in
     * four different shadow roots with four different inherited sizes — the keypad's own rule sets
     * --text-lg, pt-game's sets --text-base, and the two slotted wrappers set nothing and inherit
     * from the page. The same icon came out 25px, 20px, and 17px in one row. Nothing here wants to
     * scale with type: the row is a fixed strip of controls, and its icons should match each other
     * rather than their containers.
     */
    .action .icon {
        width: 1rem;
        height: 1rem;
    }

    /* Never wraps and never widens its button: it ellipses instead, and the accessible name is
       the whole word whatever the box does to it. */
    .action-label {
        overflow: hidden;
        max-width: 100%;
        font-size: var(--text-sm);
        line-height: 1.2;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .action:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--ink);
    }

    .action[aria-pressed='true'] {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: var(--ink);
    }

    .action:disabled {
        color: var(--graphite);
        opacity: 0.45;
        cursor: default;
    }

    /* Where the digits already drop to fewer columns, the labels drop a step too — this is the
       width at which four of them and their gaps stop clearing 296px comfortably. */
    @media (max-width: 30rem) {
        .action-label {
            font-size: var(--text-xs);
        }
    }
`;

/**
 * A wordless, thumb-sized square — the footer's theme and About controls, and nothing else.
 *
 * The panel used every control in the app on this for one revision and it was reverted: dropping
 * the words there saved no vertical space, because the panel's height is set by the rows of keys
 * below and a shorter button bar simply left a gap. See `actionButton`, which is what the panel
 * uses now.
 *
 * It survives here because the footer's two controls are genuinely peripheral, they sit on a line
 * of their own with nothing to align to, and a sun and an ⓘ are about as legible as an icon gets.
 * Both carry `aria-label` and `title`.
 */
export const iconButton = css`
    .icon-button {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 2.75rem;
        min-height: 2.75rem;
        padding: 0;
        border: var(--border);
        border-radius: var(--radius-control);
        background: var(--paper-raised);
        color: var(--graphite);
        cursor: pointer;
        touch-action: manipulation;
    }

    .icon-button:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--ink);
    }

    .icon-button[aria-pressed='true'] {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: var(--ink);
    }

    .icon-button:disabled {
        color: var(--graphite);
        opacity: 0.45;
        cursor: default;
    }
`;

/**
 * The accent for a control that gives something up — Leave room, and nothing else.
 *
 * Outlined rather than filled, like every other button in the app: the red is in the border, the
 * word, and the icon, and the ground stays paper until the pointer is on it. A solid red button
 * would be the loudest thing on a screen whose subject is a puzzle, and it sits in a row with three
 * ordinary actions that it must not shout over — it has to read as *different*, not as *urgent*.
 *
 * `--danger`, never `--wrong`: see the token for why the two are kept apart.
 *
 * **The focus ring stays accent.** There is one focus ring in this app (brand.md §4) and it is the
 * accent, everywhere, because accent-on-the-outside is what "focused" means in every other control
 * — a red ring here would be a second vocabulary for the same idea, and the resting border already
 * says everything the colour has to say.
 */
export const dangerButton = css`
    button.danger {
        border-color: color-mix(in srgb, var(--danger) 50%, transparent);
        color: var(--danger);
    }

    button.danger:hover:not(:disabled) {
        border-color: var(--danger);
        background: color-mix(in srgb, var(--danger) 10%, transparent);
    }
`;

/**
 * A row of mutually exclusive options — the puzzle pickers.
 *
 * The chosen option is washed with the accent rather than filled with it: colour belongs to people,
 * so a selected control borrows the same 16% wash the selected grid cell uses (brand.md §3).
 */
export const optionGroup = css`
    .options {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        justify-content: center;
        padding: 0;
        margin: 0;
        list-style: none;
    }

    .option {
        padding: var(--space-1) var(--space-4);
        border: var(--border);
        border-radius: var(--radius-control);
        background: var(--paper-raised);
        color: var(--graphite);
        font-family: var(--font-ui);
        font-size: var(--text-base);
        cursor: pointer;
    }

    .option[aria-pressed='true'] {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: var(--ink);
        font-weight: 700;
    }

    .option:disabled {
        border-color: var(--rule);
        color: var(--graphite);
        opacity: 0.5;
        cursor: default;
    }
`;
