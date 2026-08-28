/**
 * A modal confirm, used for the one destructive action in the app: Reveal.
 *
 * Built on the native <dialog> so focus trapping, Escape, and the inert backdrop come from the
 * platform rather than from hand-written key handling, which is the part of a custom modal that
 * is usually subtly wrong.
 */

import { LitElement, css, html } from 'lit';

import { controls } from '../styles/controls.js';

export class PtConfirm extends LitElement {
    static properties = {
        open: { type: Boolean },
        heading: { type: String },
        body: { type: String },
        confirmLabel: { type: String },
    };

    static styles = [
        controls,
        css`
            dialog {
                max-width: 24rem;
                padding: var(--space-6);
                border: var(--border);
                border-radius: var(--radius-modal);
                background: var(--paper-raised);
                color: var(--ink);
                text-align: center;
                box-shadow: var(--shadow-modal);
            }

            dialog[open] {
                animation: rise var(--motion-modal) ease-out;
            }

            dialog::backdrop {
                background: color-mix(in srgb, var(--ink) 40%, transparent);
            }

            h2 {
                margin: 0 0 var(--space-3);
                font-family: var(--font-display);
                font-size: var(--text-xl);
                font-weight: 600;
            }

            p {
                margin: 0 0 var(--space-6);
                color: var(--graphite);
            }

            .buttons {
                display: flex;
                gap: var(--space-3);
                justify-content: center;
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
        this.heading = '';
        this.body = '';
        this.confirmLabel = 'Confirm';
    }

    /** Opens and closes the real dialog element to match the open property. */
    updated(changed) {
        if (!changed.has('open')) return;

        const dialog = this.renderRoot.querySelector('dialog');
        if (!dialog) return;
        if (this.open && !dialog.open) dialog.showModal();
        if (!this.open && dialog.open) dialog.close();
    }

    /** Reports the player's answer. The opener owns open, so this only announces. */
    #answer(accepted) {
        this.dispatchEvent(
            new CustomEvent(accepted ? 'pt-confirm-accept' : 'pt-confirm-cancel', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <dialog aria-labelledby="confirm-heading" @cancel=${() => this.#answer(false)}>
                <h2 id="confirm-heading">${this.heading}</h2>
                <p>${this.body}</p>
                <div class="buttons">
                    <button type="button" @click=${() => this.#answer(false)}>Cancel</button>
                    <button type="button" @click=${() => this.#answer(true)}>
                        ${this.confirmLabel}
                    </button>
                </div>
            </dialog>
        `;
    }
}

customElements.define('pt-confirm', PtConfirm);
