/**
 * The clue under the cursor, and the way to the next one.
 *
 * It is the top strip of the input panel (ADR-0010), which is where a clue belongs once the keys are
 * pinned to the bottom of the screen: the clue and the letters that answer it are read as one thing,
 * and putting them in one block means a solver's eyes never travel between the question and the keys.
 * Not a pinned bar of its own positioned off visualViewport: that went with the phone keyboard
 * that made it necessary.
 *
 * What it carries is the clue and nothing else. Rebus, Undo, and All clues sit in the panel's button
 * bar with every other action, rather than crowding the one piece of text on this screen that a
 * solver actually has to read.
 *
 * Holds no state. It is told which entry is current and reports that it was pressed, like every other
 * shared leaf in this app.
 *
 * It has no disabled state, unlike every other control in the panel. The keys write and the clue bar
 * only *moves*, and a finished grid is still read, so the strip goes on working after the last
 * letter lands, for the same reason the arrow keys do.
 */

import { LitElement, css, html } from 'lit';

import { focusRing } from '../styles/controls.js';

import { iconStyle, nextIcon } from './icons.js';

export class PtClueBar extends LitElement {
    static properties = {
        entry: { type: Object },
    };

    static styles = [
        focusRing,
        iconStyle,
        css`
            :host {
                display: block;
            }

            /*
             * The clue itself is the button, and pressing it goes to the next clue in the direction
             * being worked. Making the whole strip the target rather than hanging a small arrow off
             * the end is what makes moving on a thumb-sized action, which it has to be: it is the
             * most-used control on this screen after the letters themselves.
             */
            .clue {
                display: flex;
                gap: var(--space-3);
                align-items: center;
                width: 100%;
                min-height: 2.75rem;
                padding: var(--space-2) var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-base);
                text-align: left;
                cursor: pointer;
                touch-action: manipulation;
                /* Our own :active ground replaces the platform's tap flash; see controls.js. */
                -webkit-tap-highlight-color: transparent;
            }

            @media (hover: hover) {
                .clue:hover:not(:disabled) {
                    border-color: var(--accent);
                }
            }

            .clue:active:not(:disabled) {
                background: color-mix(in srgb, var(--ink) 10%, var(--paper-raised));
            }

            /*
             * "7D", not "7 Down".
             *
             * The clue shares its line with the number and an arrow, and a spelled-out direction cost
             * about four characters of the clue itself on every entry, while saying nothing a solver
             * does not already know from the grid. The full words are still in the button's accessible
             * name, where there is no such pressure.
             *
             * Set in the accent and never wrapping, so the eye finds it instantly on a strip whose
             * text changes every few seconds. Tabular figures keep it from shifting width as the
             * number climbs.
             */
            .num {
                flex-shrink: 0;
                color: var(--accent);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            /*
             * Wrapped, not cut off. A clue a solver cannot finish reading is a clue they have to
             * leave the screen for, and a long one is exactly when they need it most, so the strip
             * grows a line rather than an ellipsis. The keys move down with it, which the panel
             * already handles: it measures itself and the page reserves what it reports, so the
             * grid above stays whole either way.
             *
             * A single word longer than the strip breaks rather than pushing the arrow off the end.
             */
            .text {
                flex: 1;
                min-width: 0;
                overflow-wrap: break-word;
            }

            .next {
                flex-shrink: 0;
                color: var(--graphite);
            }

            .empty {
                color: var(--graphite);
                font-style: italic;
            }
        `,
    ];

    constructor() {
        super();
        this.entry = null;
    }

    /** Keeps the grid's keyboard focus where it is, the same as every key in the panel. */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces a press; the screen decides what to do with it. */
    #emit(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    render() {
        const entry = this.entry;
        const direction = entry?.dir === 'A' ? 'Across' : 'Down';

        return html`
            <button
                class="clue"
                type="button"
                ?disabled=${!entry}
                aria-label=${
                    entry
                        ? `${entry.num} ${direction}: ${entry.clue}. Next ${direction} clue`
                        : 'No clue'
                }
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-clue-next')}
            >
                ${
                    entry
                        ? html`
                              <span class="num">${entry.num}${entry.dir}</span>
                              <span class="text">${entry.clue}</span>
                              <span class="next">${nextIcon}</span>
                          `
                        : html`<span class="empty">pick a square to start</span>`
                }
            </button>
        `;
    }
}

customElements.define('pt-clue-bar', PtClueBar);
