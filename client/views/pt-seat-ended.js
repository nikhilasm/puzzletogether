/**
 * The dialog that says a seat has ended, and why: one dialog for every way a room stops being yours
 * unasked, differing only in the sentence (ADR-0025). Red-accented, the only place --danger paints
 * something that is not a control, on the native dialog like pt-confirm.
 */

import { LitElement, css, html } from 'lit';

import { ERROR } from '../../shared/protocol.js';
import { controls } from '../styles/controls.js';

/**
 * What to call each ending. The server's message says what happened; this says it in three words
 * first, because a heading is what gets read before the sentence under it.
 */
const HEADINGS = {
    [ERROR.KICKED]: 'You were removed',
    [ERROR.ROOM_CLOSED]: 'The room closed',
    [ERROR.ROOM_NOT_FOUND]: 'The room has ended',
    [ERROR.NOT_IN_ROOM]: 'You lost your seat',
    [ERROR.SEAT_TAKEN]: 'Another tab has the seat',
};

export class PtSeatEnded extends LitElement {
    static properties = {
        /** The AckError the seat ended with, or null while the player still holds one. */
        reason: { attribute: false },
    };

    static styles = [
        controls,
        css`
            /* The red is in the rule and the heading, never a ground, the same treatment dangerButton
               gives Leave Room since a filled red panel would be the loudest thing over mild news. */
            dialog {
                max-width: 24rem;
                padding: var(--space-6);
                border: var(--border);
                border-color: color-mix(in srgb, var(--danger) 50%, transparent);
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
                color: var(--danger);
                font-family: var(--font-display);
                font-size: var(--text-xl);
                font-weight: 600;
            }

            p {
                margin: 0 0 var(--space-6);
                color: var(--graphite);
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
        this.reason = null;
    }

    /** Opens and closes the real dialog element to match whether there is a reason to show. */
    updated(changed) {
        if (!changed.has('reason')) return;

        const dialog = this.renderRoot.querySelector('dialog');
        if (!dialog) return;
        if (this.reason && !dialog.open) dialog.showModal();
        if (!this.reason && dialog.open) dialog.close();
    }

    /** Reports that the player has read it. The opener owns the reason, so this only announces. */
    #close() {
        this.dispatchEvent(
            new CustomEvent('pt-seat-ended-close', { bubbles: true, composed: true }),
        );
    }

    /** Escape closes it like the button does, rather than quietly, leaving the route behind. */
    #onCancel(event) {
        event.preventDefault();
        this.#close();
    }

    render() {
        return html`
            <dialog
                role="alertdialog"
                aria-labelledby="ended-heading"
                aria-describedby="ended-body"
                @cancel=${this.#onCancel}
            >
                <h2 id="ended-heading">
                    ${this.reason ? (HEADINGS[this.reason.code] ?? 'You have left the room') : ''}
                </h2>
                <p id="ended-body">${this.reason?.message ?? ''}</p>
                <button type="button" @click=${this.#close}>Close</button>
            </dialog>
        `;
    }
}

customElements.define('pt-seat-ended', PtSeatEnded);
