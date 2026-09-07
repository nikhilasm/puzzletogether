/**
 * What this app is, what version you are looking at, and what it is built out of, since the footer's
 * version line alone answered a question almost nobody asks. Built on the native dialog like
 * pt-confirm, and the one screen with no room, socket, or state beyond whether it is open.
 */

import { LitElement, css, html } from 'lit';

import { GITHUB_URL } from '../../shared/constants.js';
import { controls } from '../styles/controls.js';
import { closeIcon, iconStyle } from '../ui/icons.js';

export class PtAbout extends LitElement {
    static properties = {
        open: { type: Boolean },
    };

    static styles = [
        controls,
        iconStyle,
        css`
            /* No position here, deliberately: setting it would override the UA's dialog:modal
               centring and drop the panel into the document, off screen on a scrolled phone. */
            dialog {
                max-width: 28rem;
                padding: 0;
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
                padding: var(--space-6);
            }

            /* The wordmark at the dialog's own scale, set as a heading in Fraunces with the page's
               WONK so the dialog reads as part of this app. */
            h2 {
                margin: 0 0 var(--space-4);
                font-family: var(--font-display);
                font-variation-settings: var(--wordmark-variation);
                font-size: var(--text-xl);
                font-weight: 600;
            }

            h2 .together {
                color: var(--accent);
            }

            h3 {
                margin: var(--space-6) 0 var(--space-2);
                font-family: var(--font-ui);
                font-size: var(--text-sm);
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--graphite);
            }

            p {
                margin: 0 0 var(--space-3);
                color: var(--graphite);
                font-size: var(--text-sm);
                line-height: 1.55;
            }

            p:last-of-type {
                margin-bottom: 0;
            }

            a {
                color: var(--accent-text);
            }

            /* The version, in the mono face every machine-readable string takes, a fact to be quoted
               back in a bug report. */
            .version {
                font-family: var(--font-mono);
                font-size: var(--text-sm);
                color: var(--graphite);
            }

            /* The close control in the corner rather than a row of its own, since this dialog asks
               nothing and Escape and the backdrop close it too. */
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
        this.dispatchEvent(new CustomEvent('pt-about-close', { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <dialog aria-labelledby="about-heading" @cancel=${this.#close}>
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

                    <h2 id="about-heading">Puzzle<span class="together">Together</span></h2>

                    <p>
                        A room you can send someone, and a puzzle you solve in it together.
                        Everybody sees the same grid as it fills in. Nobody needs an account to
                        join.
                    </p>

                    <h3>Puzzles</h3>
                    <p>
                        Sudoku, KenKen, Nonogram, Kakuro, and Suguru puzzles are generated here, on
                        demand, and checked for a single solution before they are served. Crosswords
                        come from a bank of imported files, each of which records its own author,
                        source, and license.
                    </p>

                    <h3>Built with</h3>
                    <p>Lit, Express, and Socket.IO. Typeset in Fraunces, Karla, and DM Mono.</p>

                    <h3>Source</h3>
                    <p>
                        The code is on
                        <a href=${GITHUB_URL} rel="noreferrer" target="_blank">GitHub</a>, under an
                        open license.
                    </p>
                </div>
            </dialog>
        `;
    }
}

customElements.define('pt-about', PtAbout);
