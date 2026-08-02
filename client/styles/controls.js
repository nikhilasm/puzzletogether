/**
 * Shared control styling — buttons, inputs, and the loading line.
 *
 * A `css` fragment rather than a global stylesheet, so it composes into each component's
 * `static styles` and stays inside their shadow roots (code-style.md §9).
 */

import { css } from 'lit';

export const controls = css`
    button {
        padding: var(--space-2) var(--space-6);
        border: var(--border);
        border-radius: var(--radius-pill);
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
        border-radius: var(--radius-pill);
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
