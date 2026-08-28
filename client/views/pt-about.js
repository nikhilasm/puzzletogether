/**
 * What this app is, what version of it you are looking at, and what it is built out of.
 *
 * It exists because the footer stopped being able to say those things. Once the theme control became
 * an icon button and the links moved onto one line, a version number sitting under them was the only
 * prose left down there, and a version number on its own answers a question almost nobody asks
 * while the questions people *do* ask (what is this, who made the puzzles, can I look at the code)
 * had nowhere to be answered at all.
 *
 * Built on the native <dialog> for the same reason <pt-confirm> is: focus trapping, Escape, and
 * an inert backdrop come from the platform rather than from hand-written key handling, which is the
 * part of a custom modal that is usually subtly wrong.
 *
 * Nothing here is live. It is the one screen in the app with no room, no socket, and no state, so
 * it takes its facts from shared/constants.js and holds none of its own beyond whether it is open,
 * which its owner sets.
 */

import { LitElement, css, html } from 'lit';

import { APP_VERSION, GITHUB_URL } from '../../shared/constants.js';
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
            /*
             * No position here, deliberately.
             *
             * A modal dialog is centred by the UA's own dialog:modal rule: position: fixed against
             * the viewport, with inset: 0 and auto margins. Setting position: relative to hang the
             * close button off overrode that, which took the panel out of the viewport and put it in
             * the document: on a phone with the page scrolled it opened wherever the top of the
             * document happened to be, usually off screen. The close button gets its containing
             * block from .sheet instead, which owns the padding with it.
             */
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

            /*
             * The wordmark, at the dialog's own scale rather than the page's.
             *
             * It is the heading here, so it is set as one: --text-xl and Fraunces with the same
             * WONK the page's wordmark carries, which is what makes the dialog read as part of this
             * app rather than as a browser-standard about box.
             */
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

            /* The version, set in the mono face every other machine-readable string in the app
               uses, the room code above all. It is a fact to be quoted back in a bug report, not
               prose. */
            .version {
                font-family: var(--font-mono);
                font-size: var(--text-sm);
                color: var(--graphite);
            }

            /*
             * The close control, in the corner rather than as a button on a row of its own.
             *
             * This dialog asks nothing and so has no answer to give: a pt-confirm-style pair of
             * buttons at the foot would be one button pretending to be a choice. Escape and the
             * backdrop both close it too; this is the affordance that says so.
             */
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
                        Everybody sees the same grid as it fills in: sudoku, KenKen, nonograms, and
                        crosswords. Nobody needs an account to join.
                    </p>
                    <p class="version">v${APP_VERSION}</p>

                    <h3>Puzzles</h3>
                    <p>
                        Sudoku, KenKen, and nonogram puzzles are generated here, on demand, and
                        checked for a single solution before they are served. Crosswords come from a
                        bank of imported files, each of which records its own author, source, and
                        licence.
                    </p>

                    <h3>Built with</h3>
                    <p>
                        Lit, Express, and Socket.IO. Set in Fraunces, Karla, and DM Mono, all three
                        self-hosted and open-licensed.
                    </p>

                    <h3>Source</h3>
                    <p>
                        The code is on
                        <a href=${GITHUB_URL} rel="noreferrer" target="_blank">GitHub</a>, under an
                        open licence.
                    </p>
                </div>
            </dialog>
        `;
    }
}

customElements.define('pt-about', PtAbout);
