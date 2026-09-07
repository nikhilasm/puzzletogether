/**
 * Shared control styling: the focus ring, buttons, inputs, and the loading line.
 *
 * A css fragment rather than a global stylesheet, so it composes into each component's
 * static styles and stays inside their shadow roots (code-style.md §9).
 */

import { css } from 'lit';

/**
 * The one focus ring in the app, repeated into every shadow root that holds something focusable,
 * since the base.css rule reaches the light DOM only. Compose this, or controls which includes it,
 * wherever anything can take focus.
 */
export const focusRing = css`
    :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
`;

/**
 * Every hover rule in the app sits behind @media (hover: hover): a touch browser emulates hover on
 * whatever was tapped last and holds it, turning an ungated hover into a stuck accent frame
 * (code-style.md §9). :active answers a tap instead, which the panel's controls rely on since they
 * preventDefault to keep the grid focused and never take focus themselves.
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
 * draws on top. Used by the input panel and the footer; the label stacks under the icon so four fit
 * a narrow screen, and the pressed state moves four channels (border, wash, icon fill, bold label)
 * without ever filling, since colour belongs to people (brand.md §3).
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
        /* The platform's tap flash is off here because the :active ground below replaces it; a
           control with no :active of its own keeps the flash, since silence on a tap is worse. */
        -webkit-tap-highlight-color: transparent;
    }

    /* A fixed 1rem, not iconStyle's 1.25em, so the icons match each other rather than the four
       different inherited font sizes of the shadow roots they land in. */
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

    /* Mixed into --paper-raised, not transparent, so the page texture does not show through the
       button (brand.md §4); every wash on a control's ground below is mixed the same way. */
    .action[aria-pressed='true'] {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 16%, var(--paper-raised));
        color: var(--ink);
    }

    /* The third channel: the glyph fills with a 35% accent wash and goes accent, a wash rather than
       a solid fill so an outline icon's interior strokes still show through. */
    .action[aria-pressed='true'] .icon {
        color: var(--accent-text);
        fill: color-mix(in srgb, var(--accent) 35%, transparent);
    }

    /* The fourth channel: the word thickens, costing no width since the buttons flex 1 1 0 and
       share the row equally. */
    .action[aria-pressed='true'] .action-label {
        font-weight: 700;
    }

    /* Under the finger, last so it wins over the pressed wash, since turning a setting off needs the
       same acknowledgement as turning it on. */
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
 * The colour for a control that gives something up: Leave room, and nothing else. Outlined rather
 * than filled so it reads as different, not urgent (brand.md §4); --danger not --wrong, and the
 * focus ring stays accent.
 */
export const dangerButton = css`
    button.danger {
        border-color: color-mix(in srgb, var(--danger) 50%, transparent);
        color: var(--danger);
    }

    @media (hover: hover) {
        button.danger:hover:not(:disabled) {
            border-color: var(--danger);
            background: color-mix(in srgb, var(--danger) 10%, var(--paper-raised));
        }
    }

    /* Its own press ground rather than the shared ink mix: this is the one control whose resting
       state is already red, and a neutral darkening on top of it read as the red going muddy. */
    button.danger:active:not(:disabled) {
        border-color: var(--danger);
        background: color-mix(in srgb, var(--danger) 18%, var(--paper-raised));
    }
`;

/**
 * The colour for a control that starts the next thing: Start another, and Puzzle Select's Start
 * button. The same outlined shape as dangerButton, using --accent-text since a button label sits at
 * body size (brand.md §2).
 */
export const accentButton = css`
    button.accent {
        border-color: color-mix(in srgb, var(--accent) 50%, transparent);
        color: var(--accent-text);
    }

    @media (hover: hover) {
        button.accent:hover:not(:disabled) {
            border-color: var(--accent);
            background: color-mix(in srgb, var(--accent) 10%, var(--paper-raised));
        }
    }

    button.accent:active:not(:disabled) {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 18%, var(--paper-raised));
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
        background: color-mix(in srgb, var(--accent) 16%, var(--paper-raised));
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
