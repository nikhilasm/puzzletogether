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
