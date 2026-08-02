/**
 * The icon set: inline SVG, drawn here rather than pulled from a pack.
 *
 * There are seven of them, they are all simple geometry, and a dependency would cost more than it
 * saves. Emoji are banned as UI icons (brand.md §1) because they render as somebody else's artwork
 * at somebody else's weight — these instead inherit `currentColor` and the app's line weight, so an
 * icon inside a disabled control greys out with it and the dark theme needs no second asset.
 *
 * Every icon is decorative: it repeats a label that is already there, so it is `aria-hidden` and
 * the control around it carries the accessible name.
 *
 * Geometry lives here; size and weight live in `iconStyle`, which each consuming component composes
 * into its own styles — shadow roots inherit properties, not rules.
 */

import { css, html } from 'lit';

/** Sizing and stroke for any `.icon` in a shadow root that composes this. */
export const iconStyle = css`
    .icon {
        flex: none;
        width: 1.25em;
        height: 1.25em;
        fill: none;
        stroke: currentColor;
        stroke-width: var(--stroke-icon);
        stroke-linecap: round;
        stroke-linejoin: round;
    }
`;

/** An eraser at the angle you would hold it, over the line it has taken out. */
export const eraseIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
            d="M9 20 3.4 14.4a1.4 1.4 0 0 1 0-2L12.6 3.2a1.4 1.4 0 0 1 2 0l5.6 5.6a1.4 1.4 0 0 1 0 2L11 20Z"
        />
        <path d="M21 20H9" />
        <path d="m7 9.6 7.4 7.4" />
    </svg>
`;

/** An arrow doubling back on itself — the one shape everybody already reads as undo. */
export const undoIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M4 8h9.5a5.5 5.5 0 0 1 0 11H7" />
        <path d="m8 4-4 4 4 4" />
    </svg>
`;

/** Pencil marks — the same idea the `--pencil` colour carries inside the grid. */
export const pencilIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path
            d="m4 20 .9-3.6a2 2 0 0 1 .5-.9L15.7 5.2a2 2 0 0 1 2.8 0l1.3 1.3a2 2 0 0 1 0 2.8L9.5 19.6a2 2 0 0 1-.9.5Z"
        />
        <path d="m14.5 6.5 3 3" />
    </svg>
`;

/** The light theme — "paper". */
export const sunIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        <path d="m4.9 4.9 1.5 1.5M17.6 17.6l1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </svg>
`;

/** Leaving a room: out through the doorway, not a power symbol — nothing is being shut down. */
export const leaveIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
        <path d="m9 8-4 4 4 4" />
        <path d="M5 12h10" />
    </svg>
`;

/** Removing somebody. Small and unlabelled, so its control carries the name. */
export const closeIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="m7 7 10 10M17 7 7 17" />
    </svg>
`;

/** The dark theme — "evening desk". */
export const moonIcon = html`
    <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
    </svg>
`;
