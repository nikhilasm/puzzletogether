/**
 * The clue for the entry under the cursor, and the control that turns the cursor around.
 *
 * The one thing a crossword solver needs at every moment, so the one thing always on screen — the
 * full lists live behind a button (design-spec.md §4). It is also the direction toggle, because
 * flipping between Across and Down is offered where the player is already looking rather than as a
 * separate control elsewhere.
 *
 * Holds nothing. It is told which entry is current and reports that it was pressed, like every other
 * shared leaf in this app.
 */

import { LitElement, css, html, nothing } from 'lit';

import { focusRing } from '../styles/controls.js';

import { iconStyle, listIcon, swapIcon } from './icons.js';

export class PtClueBar extends LitElement {
    static properties = {
        entry: { type: Object },
        disabled: { type: Boolean },
    };

    static styles = [
        focusRing,
        iconStyle,
        css`
            :host {
                display: block;
                max-width: 480px;
                margin: 0 auto var(--space-3);
            }

            .bar {
                display: flex;
                gap: var(--space-2);
                align-items: stretch;
            }

            /*
             * The clue itself is the button. Making the whole strip the target rather than hanging a
             * small ⇄ off the end is what makes flipping direction a thumb-sized action on a phone,
             * which it has to be — it is the most-used control on this screen after the letters.
             */
            .clue {
                display: flex;
                flex: 1;
                gap: var(--space-3);
                align-items: center;
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
            }

            .clue:hover:not(:disabled) {
                border-color: var(--accent);
            }

            /*
             * The number is set in the accent and never wraps, so the eye finds "7 Down" instantly
             * on a bar whose text changes every few seconds. Tabular figures keep it from shifting
             * width as the number climbs.
             */
            .num {
                flex-shrink: 0;
                color: var(--accent);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            .text {
                flex: 1;
            }

            .swap {
                flex-shrink: 0;
                color: var(--graphite);
            }

            .list {
                display: flex;
                flex-shrink: 0;
                gap: var(--space-2);
                align-items: center;
                padding: var(--space-2) var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-sm);
                cursor: pointer;
            }

            .list:hover {
                border-color: var(--accent);
            }

            .empty {
                color: var(--graphite);
                font-style: italic;
            }

            /* The label goes at the narrowest widths; the icon carries it, with the name in aria. */
            @media (max-width: 30rem) {
                .list span {
                    display: none;
                }
            }
        `,
    ];

    constructor() {
        super();
        this.entry = null;
        this.disabled = false;
    }

    /** Announces a press; the screen decides what to do with it. */
    #emit(name) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    }

    render() {
        const entry = this.entry;
        const where = entry ? `${entry.num} ${entry.dir === 'A' ? 'Across' : 'Down'}` : '';

        return html`
            <div class="bar">
                <button
                    class="clue"
                    type="button"
                    ?disabled=${this.disabled || !entry}
                    aria-label=${entry ? `${where}: ${entry.clue}. Switch direction` : 'No clue'}
                    @click=${() => this.#emit('pt-clue-flip')}
                >
                    ${
                        entry
                            ? html`
                                  <span class="num">${where}</span>
                                  <span class="text">${entry.clue}</span>
                                  <span class="swap">${swapIcon}</span>
                              `
                            : html`<span class="empty">pick a square to start</span>`
                    }
                </button>
                <button
                    class="list"
                    type="button"
                    aria-label="All clues"
                    @click=${() => this.#emit('pt-clue-list-open')}
                >
                    ${listIcon}<span>All clues</span>
                </button>
            </div>
        `;
    }
}

customElements.define('pt-clue-bar', PtClueBar);
