/**
 * Crossword's on-screen keyboard: QWERTY, plus Erase and Undo.
 *
 * The counterpart of `<pt-keypad>` for a puzzle whose alphabet is 26 letters rather than 9 digits,
 * and it exists rather than deferring to the phone's own keyboard for three reasons that only get
 * worse with time: a native keyboard brings autocapitalize, autocorrect, and predictive text to a
 * grid that wants exactly one letter; it takes a share of the viewport the page cannot query or
 * influence, which on a 15×15 decides whether the grid is visible at all; and reaching it needs an
 * offscreen `<input>` holding focus, maintained per platform. → design-spec.md §4
 *
 * QWERTY rather than alphabetical. Nobody hunts for `M` in a grid of 26 alphabetical keys as fast as
 * they hit it on the layout their thumbs already know.
 */

import { LitElement, css, html } from 'lit';

import { focusRing } from '../styles/controls.js';

import { eraseIcon, iconStyle, undoIcon } from './icons.js';

/** The three rows every phone keyboard has, so the muscle memory transfers intact. */
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export class PtLetterPad extends LitElement {
    static properties = {
        canUndo: { type: Boolean },
        disabled: { type: Boolean },
    };

    static styles = [
        focusRing,
        iconStyle,
        css`
            :host {
                display: block;
            }

            /*
             * Ten columns for every row, with the shorter rows centred by spanning their gaps. A
             * QWERTY row is nine or seven keys wide against the top row's ten, and sizing each row
             * to its own contents made three different key widths — which is the one thing a thumb
             * notices, because it moves the letters out from under where they were last time.
             */
            .row {
                display: grid;
                grid-template-columns: repeat(20, minmax(0, 1fr));
                gap: var(--space-1);
                margin-bottom: var(--space-1);
            }

            .row button {
                grid-column: span 2;
            }

            .row.mid {
                padding: 0 5%;
            }

            .row.low {
                padding: 0 15%;
            }

            /*
             * 44px tall, the app's touch target everywhere else. The *width* cannot follow it — ten
             * keys across a 320px screen is 25px each however it is arranged, which is what every
             * phone keyboard does and the reason the layout is borrowed from one rather than
             * invented. Height is the axis still free to be generous, so it is.
             */
            button {
                min-width: 0;
                min-height: 2.75rem;
                padding: var(--space-1);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-base);
                cursor: pointer;
                touch-action: manipulation;
            }

            button:hover:not(:disabled) {
                border-color: var(--accent);
            }

            button:disabled {
                color: var(--graphite);
                opacity: 0.45;
                cursor: default;
            }

            .actions {
                display: flex;
                gap: var(--space-2);
                justify-content: center;
                margin-top: var(--space-3);
            }

            .actions button {
                display: flex;
                gap: var(--space-2);
                align-items: center;
                justify-content: center;
                min-width: 6rem;
                padding: var(--space-2) var(--space-3);
            }
        `,
    ];

    constructor() {
        super();
        this.canUndo = false;
        this.disabled = false;
    }

    /**
     * Keeps the grid's keyboard focus where it is when a key is tapped.
     *
     * Without this the grid blurs, arrow keys stop working after any press, and the cursor appears
     * to jump on touch — the same reason `<pt-keypad>` does it.
     */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces a key press; the store decides what it means in the current mode. */
    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    render() {
        return html`
            ${ROWS.map(
                (row, i) => html`
                    <div class="row ${['top', 'mid', 'low'][i]}" role="group" aria-label="letters">
                        ${[...row].map(
                            (letter) => html`
                                <button
                                    type="button"
                                    ?disabled=${this.disabled}
                                    @pointerdown=${this.#onPointerDown}
                                    @click=${() => this.#emit('pt-letter', { value: letter })}
                                >
                                    ${letter}
                                </button>
                            `,
                        )}
                    </div>
                `,
            )}
            <div class="actions">
                <button
                    type="button"
                    ?disabled=${this.disabled}
                    @pointerdown=${this.#onPointerDown}
                    @click=${() => this.#emit('pt-letter-erase', {})}
                >
                    ${eraseIcon} Erase
                </button>
                <button
                    type="button"
                    ?disabled=${this.disabled || !this.canUndo}
                    @pointerdown=${this.#onPointerDown}
                    @click=${() => this.#emit('pt-letter-undo', {})}
                >
                    ${undoIcon} Undo
                </button>
            </div>
        `;
    }
}

customElements.define('pt-letter-pad', PtLetterPad);
