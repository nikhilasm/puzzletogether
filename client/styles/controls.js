/**
 * Shared control styling: the focus ring, buttons, inputs, and the loading line.
 *
 * A css fragment rather than a global stylesheet, so it composes into each component's
 * static styles and stays inside their shadow roots (code-style.md §9).
 */

import { css } from 'lit';

/**
 * The one focus ring in the app.
 *
 * It has to be repeated into every shadow root that holds something focusable: the rule in
 * base.css reaches the light DOM only, so a component that omits this silently falls back to the
 * browser's own ring and the app ends up with two different focus colours. Compose this, or
 * controls which includes it, wherever anything can take focus.
 */
export const focusRing = css`
    :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
`;

/**
 * Every hover rule in the app sits behind @media (hover: hover), and this is why.
 *
 * A touch browser has no pointer that can leave an element, so it emulates hover on whatever was
 * tapped last and holds it there until something else is tapped. Ungated, that turned every hover
 * rule into a state that outlived the tap, and since hover here is border-color: var(--accent),
 * what a solver was left looking at was an accent frame on an unfocused control, which is the exact
 * thing §4 says reads as a stuck focus ring. On a setting it was worse than ambiguous: an accent
 * border over a darkened label is a pressed button missing only its wash.
 *
 * It is not the focus ring, and could not have been. :focus-visible does not match a touch
 * activation, and every control in the input panel calls preventDefault() on pointerdown to keep
 * the grid focused, so those buttons never take focus from a tap at all.
 *
 * hover: hover is true only where a pointer can rest on something without pressing it, so a phone
 * gets no hover state and a mouse keeps every one it had. What answers a tap instead is :active,
 * which the browser clears on release; the panel's controls would otherwise have no press feedback
 * at all, since the sticky hover had been quietly providing it.
 */

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

    @media (hover: hover) {
        button:hover:not(:disabled) {
            border-color: var(--accent);
        }
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
 * A control in a bar of actions: an icon over a one-word label, and the pressed state a toggle
 * draws on top of it.
 *
 * The input panel's controls and the footer's. It was written for the panel, which is where the
 * measurements below come from; the footer took it when its two wordless squares became four
 * labelled controls, and inherited the same rule about where the word goes.
 *
 * One fragment for both because they are one control: .action is the box, and adding
 * aria-pressed is what makes it a setting rather than an action. That is the whole of the
 * difference in the markup and the whole of the difference on screen.
 *
 * **The label is under the icon, not beside it.** Side by side, four of these come to about 330px
 * and the narrowest screen we support has 296px to give, so the row wraps, which is the thing
 * the panel cannot afford. Stacked, the same four fit in 236px and the button gets *taller* rather
 * than wider, which it can be: the panel's height is set by the keys underneath.
 *
 * **The buttons share the row equally** (flex: 1 1 0), capped so they do not stretch into paddles
 * on a desktop. A row of identical boxes is also what makes the label legible at --text-xs: you
 * are reading a word you already half-know from the icon above it.
 *
 * **The pressed state moves four channels, and never fills.** The border takes the accent, the
 * ground takes the same 16% accent wash a selected cell carries, the icon fills and goes accent, and
 * the label goes bold. The ground is still a wash and not a fill, since colour belongs to people
 * (brand.md §3), and the wash is the same value optionGroup gives a chosen option, so "this is
 * switched on" and "this is the one you picked" go on looking alike deliberately.
 *
 * Two channels carried the grayscale check but not a phone, where the only other accent-bordered
 * thing a solver ever saw was a control they had just tapped. Two of the four are shape rather than
 * paint, since a glyph that fills and a word that thickens both survive losing colour outright, and
 * all four live *inside* the button. That is what separates them from focus, which is one ring
 * outside the box at a 2px offset and touches none of these.
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
        /*
         * The platform's tap flash is off wherever this file draws an :active state of its own.
         *
         * Chrome's is a saturated blue rectangle over the whole control, which on a *setting* is a
         * near-miss for the pressed wash: the same confusion the stuck hover caused, briefly rather
         * than indefinitely. It also fades on its own schedule in a colour the OS picked, over a
         * button whose whole pressed vocabulary is 16% accent. The :active ground below replaces it.
         *
         * Only here. A control with no :active of its own keeps the platform flash, which is the
         * right fallback: silence on a tap is worse than a flash in the wrong blue.
         */
        -webkit-tap-highlight-color: transparent;
    }

    /*
     * A fixed 1rem, not iconStyle's 1.25em.
     *
     * An em-sized icon takes the font-size of whatever button it lands in, and these buttons are in
     * four different shadow roots with four different inherited sizes: the keypad's own rule sets
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

    @media (hover: hover) {
        .action:hover:not(:disabled) {
            border-color: var(--accent);
            color: var(--ink);
        }
    }

    .action[aria-pressed='true'] {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        color: var(--ink);
    }

    /*
     * The third channel: the glyph fills, and goes accent while it does.
     *
     * Setting color rather than stroke moves both at once: iconStyle strokes with currentColor, and
     * the fill icon's rect paints with it too, so the one solid icon in the set goes accent along
     * with the outlined ones instead of staying ink.
     *
     * The fill is a wash and not the flat accent, which is what keeps this working across a set of
     * icons drawn to be outlines. A solid fill closes the rebus icon into a plain blue box, losing
     * the three strokes inside it that are the entire point of it, and makes it the twin of the
     * fill icon, which really is a solid block. At 35% over the button's own 16% the glyph reads
     * unmistakably filled and every interior stroke still shows through it.
     *
     * The cross icon has no interior to fill, being two crossed lines, so it takes the accent and
     * nothing else. That is the icon's shape rather than a gap in the rule, and the other three
     * channels say the same thing on that button as on any other.
     */
    .action[aria-pressed='true'] .icon {
        color: var(--accent-text);
        fill: color-mix(in srgb, var(--accent) 35%, transparent);
    }

    /* The fourth: the word thickens. Costs no width: the buttons flex 1 1 0 and share the row
       equally whatever is written in them. */
    .action[aria-pressed='true'] .action-label {
        font-weight: 700;
    }

    /*
     * Under the finger. Last, so it wins over the pressed wash while the press lasts: a solver
     * turning a setting *off* has to get the same acknowledgement as one turning it on.
     */
    .action:active:not(:disabled) {
        background: color-mix(in srgb, var(--ink) 10%, var(--paper-raised));
    }

    .action:disabled {
        color: var(--graphite);
        opacity: 0.45;
        cursor: default;
    }

    /* Where the digits already drop to fewer columns, the labels drop a step too: this is the
       width at which four of them and their gaps stop clearing 296px comfortably. */
    @media (max-width: 30rem) {
        .action-label {
            font-size: var(--text-xs);
        }
    }
`;

/**
 * The accent for a control that gives something up: Leave room, and nothing else.
 *
 * Outlined rather than filled, like every other button in the app: the red is in the border, the
 * word, and the icon, and the ground stays paper until the pointer is on it. A solid red button
 * would be the loudest thing on a screen whose subject is a puzzle, and it sits in a row with three
 * ordinary actions that it must not shout over: it has to read as *different*, not as *urgent*.
 *
 * --danger, never --wrong: see the token for why the two are kept apart.
 *
 * **The focus ring stays accent.** There is one focus ring in this app (brand.md §4) and it is the
 * accent, everywhere, because accent-on-the-outside is what "focused" means in every other
 * control. A red ring here would be a second vocabulary for the same idea, and the resting border already
 * says everything the colour has to say.
 */
export const dangerButton = css`
    button.danger {
        border-color: color-mix(in srgb, var(--danger) 50%, transparent);
        color: var(--danger);
    }

    @media (hover: hover) {
        button.danger:hover:not(:disabled) {
            border-color: var(--danger);
            background: color-mix(in srgb, var(--danger) 10%, transparent);
        }
    }

    /* Its own press ground rather than the shared ink mix: this is the one control whose resting
       state is already red, and a neutral darkening on top of it read as the red going muddy. */
    button.danger:active:not(:disabled) {
        border-color: var(--danger);
        background: color-mix(in srgb, var(--danger) 18%, transparent);
    }
`;

/**
 * A row of mutually exclusive options: the puzzle pickers.
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
