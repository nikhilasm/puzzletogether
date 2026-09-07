/**
 * The clue under the cursor and the way to the next one, the top strip of the input panel (ADR-0010)
 * so the clue and the letters that answer it read as one block. It carries the clue and nothing
 * else, holds no state, and has no disabled state since a finished grid is still read.
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

            /* The clue itself is the button, pressing to the next clue in the direction being
               worked, so moving on is a thumb-sized target. */
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

            /* 7D, not 7 Down, since a spelled-out direction costs the clue characters it needs; the
               full words stay in the accessible name, and tabular figures keep the number from
               shifting width. */
            .num {
                flex-shrink: 0;
                color: var(--accent);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            /* Wrapped, not cut off, so a long clue grows the strip a line rather than an ellipsis,
               with a single over-long word breaking rather than pushing the arrow off the end. */
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
