/**
 * The dialog that says a seat has ended, and why.
 *
 * One dialog for every way a room can stop being yours without your having asked: the host removed
 * you, another tab took the seat, the room was collected, the server restarted, or you were away
 * long enough to lose it. They differ only in the sentence, so they differ only in the sentence
 * here (ADR-0025).
 *
 * Red-accented, and the only place in the app --danger paints something that is not a control: what
 * has happened is not a mistake and not an error, but it did take the room away, and the screen
 * behind it has already changed to the join form. A dialog in the page's ordinary colours would be
 * a notice about a change the player is looking straight at.
 *
 * Native <dialog> like <pt-confirm>, so focus trapping, Escape, and the inert backdrop come from
 * the platform. Told what to show and reports the press; the opener owns the reason and the route.
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
            /*
             * The red is in the rule and the heading, never in a ground. Same treatment
             * dangerButton gives Leave Room, and the same 50% resting border: a filled red panel
             * would be the loudest thing this app has ever drawn, over news that is mild.
             */
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
