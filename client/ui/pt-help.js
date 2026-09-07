/**
 * How the puzzle on screen is solved, over the grid it is about, as a dialog rather than a panel
 * since it is read once (design-spec.md §4). Built on the native dialog like pt-confirm, and holds
 * nothing: it renders the given type's entry from help-text.js.
 */

import { LitElement, css, html, nothing } from 'lit';

import { PUZZLE_TYPE_NAMES } from '../../shared/constants.js';
import { controls } from '../styles/controls.js';

import { helpFor } from './help-text.js';
import { closeIcon, iconStyle } from './icons.js';

export class PtHelp extends LitElement {
    static properties = {
        open: { type: Boolean },
        /** Which puzzle type to explain, as a doc.type. */
        type: { type: String },
    };

    static styles = [
        controls,
        iconStyle,
        css`
            /* No position here (see pt-about): setting it would centre the modal in the document
               rather than the viewport, so on a scrolled phone it opens off screen. */
            dialog {
                max-width: 30rem;
                max-height: 80vh;
                padding: 0;
                overflow-y: auto;
                border: var(--border);
                border-radius: var(--radius-modal);
                background: var(--paper-raised);
                color: var(--ink);
                text-align: left;
                box-shadow: var(--shadow-modal);
            }

            dialog[open] {
                animation: rise var(--motion-modal) ease-out;
            }

            dialog::backdrop {
                background: color-mix(in srgb, var(--ink) 40%, transparent);
            }

            /* The positioned box the close button hangs off, and the panel's padding. */
            .sheet {
                position: relative;
                box-sizing: border-box;
                padding: var(--space-6);
            }

            /* The heading names the type, padded clear of the close control so a long name cannot
               run underneath it. */
            h2 {
                margin: 0 0 var(--space-4);
                padding-right: var(--space-8);
                font-family: var(--font-display);
                font-size: var(--text-xl);
                font-weight: 600;
            }

            h3 {
                margin: var(--space-6) 0 var(--space-2);
                color: var(--graphite);
                font-family: var(--font-ui);
                font-size: var(--text-sm);
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }

            /*
             * The goal is the one sentence somebody who reads nothing else should leave with, so it
             * is --ink at the body size while the rules under it take the quieter --graphite every
             * other supporting line in the app uses.
             */
            .goal {
                margin: 0;
                color: var(--ink);
                font-size: var(--text-base);
                line-height: 1.55;
            }

            ul {
                margin: 0;
                padding: 0;
                list-style: none;
            }

            /*
             * Rules as a marked list, with the mark drawn rather than taken from list-style: the
             * gutter has to hold the second line of a wrapped rule clear of the mark, and a hanging
             * indent is what does that at every measure.
             */
            li {
                position: relative;
                margin-bottom: var(--space-2);
                padding-left: var(--space-4);
                color: var(--graphite);
                font-size: var(--text-sm);
                line-height: 1.55;
            }

            li::before {
                content: '';
                position: absolute;
                top: 0.6em;
                left: var(--space-1);
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: var(--accent);
            }

            li:last-child {
                margin-bottom: 0;
            }

            .input {
                margin: 0;
                color: var(--graphite);
                font-size: var(--text-sm);
                line-height: 1.55;
            }

            /* The close control in the corner rather than on a row of its own (like pt-about's),
               since this dialog asks nothing. */
            .close {
                position: absolute;
                top: var(--space-3);
                right: var(--space-3);
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                min-height: 2.25rem;
                padding: 0;
                border: none;
                background: none;
                color: var(--graphite);
            }

            @media (hover: hover) {
                .close:hover {
                    color: var(--ink);
                }
            }

            @keyframes rise {
                from {
                    opacity: 0;
                    transform: translateY(4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `,
    ];

    constructor() {
        super();
        this.open = false;
        this.type = '';
    }

    /** Opens and closes the real dialog element to match the open property. */
    updated(changed) {
        if (!changed.has('open')) return;

        const dialog = this.renderRoot.querySelector('dialog');
        if (!dialog) return;
        if (this.open && !dialog.open) dialog.showModal();
        if (!this.open && dialog.open) dialog.close();
    }

    /** Reports that it should be closed. The opener owns open, so this only announces. */
    #close() {
        this.dispatchEvent(new CustomEvent('pt-help-close', { bubbles: true, composed: true }));
    }

    render() {
        const help = helpFor(this.type);
        if (!help) return nothing;
        const name = PUZZLE_TYPE_NAMES[this.type] ?? this.type;

        return html`
            <dialog aria-labelledby="help-heading" @cancel=${this.#close}>
                <div class="sheet">
                    <button
                        class="close"
                        type="button"
                        aria-label="Close"
                        title="Close"
                        @click=${this.#close}
                    >
                        ${closeIcon}
                    </button>

                    <h2 id="help-heading">How to play ${name}</h2>

                    <p class="goal">${help.goal}</p>

                    <h3>Rules</h3>
                    <ul>
                        ${help.rules.map((rule) => html`<li>${rule}</li>`)}
                    </ul>

                    <h3>In this app</h3>
                    <p class="input">${help.input}</p>
                </div>
            </dialog>
        `;
    }
}

customElements.define('pt-help', PtHelp);
