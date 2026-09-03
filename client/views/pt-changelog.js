/**
 * What has changed in this app, newest release first.
 *
 * The sibling of <pt-about>: About says what this is, and this says what it has been. Both are
 * peripheral, both are opened from the footer's toolbar, and both are built on the native <dialog>
 * for the reason <pt-confirm> is: focus trapping, Escape, and an inert backdrop come from the
 * platform rather than from hand-written key handling.
 *
 * The releases are a constant in this file rather than data from the server. A changelog is written
 * by hand at the moment a version ships, it is the same for everybody, and a fetch would put a
 * spinner in front of prose that is already in the bundle.
 */

import { LitElement, css, html } from 'lit';

import { APP_VERSION } from '../../shared/constants.js';
import { controls } from '../styles/controls.js';
import { closeIcon, iconStyle } from '../ui/icons.js';

/**
 * Every release, newest first. Add to the top when the version in package.json moves.
 *
 * @type {{ version: string, date: string, changes: string[] }[]}
 */
const RELEASES = [
    {
        version: APP_VERSION,
        date: '2026-09-03',
        changes: [
            'Rooms you can send someone, with a shared grid everybody types into at once.',
            'Six puzzle types: sudoku, KenKen, nonogram, kakuro, crossword, and suguru.',
            'A light and a dark theme, remembered between visits.',
        ],
    },
];

export class PtChangelog extends LitElement {
    static properties = {
        open: { type: Boolean },
    };

    static styles = [
        controls,
        iconStyle,
        css`
            /* No position on the dialog: see <pt-about> for the bug that rule prevents. */
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

            h2 {
                margin: 0 0 var(--space-4);
                font-family: var(--font-display);
                font-variation-settings: var(--wordmark-variation);
                font-size: var(--text-xl);
                font-weight: 600;
            }

            /*
             * A release heading is its version and its date on one line, and the version is set in
             * the mono face every machine-readable string in the app takes, the room code above all.
             * It is a fact to be quoted back in a bug report rather than prose.
             */
            .release {
                margin-top: var(--space-6);
            }

            .release:first-of-type {
                margin-top: 0;
            }

            .release-head {
                display: flex;
                gap: var(--space-2);
                align-items: baseline;
                margin: 0 0 var(--space-2);
                font-weight: 400;
            }

            .version {
                font-family: var(--font-mono);
                font-size: var(--text-base);
                color: var(--ink);
            }

            .date {
                font-family: var(--font-ui);
                font-size: var(--text-sm);
                color: var(--graphite);
            }

            ul {
                margin: 0;
                padding-left: var(--space-4);
                color: var(--graphite);
                font-size: var(--text-sm);
                line-height: 1.55;
            }

            li {
                margin-bottom: var(--space-1);
            }

            /* The close control, in the corner: this dialog asks nothing, so it has no answer to
               give and no row of buttons at its foot. */
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
        this.dispatchEvent(
            new CustomEvent('pt-changelog-close', { bubbles: true, composed: true }),
        );
    }

    render() {
        return html`
            <dialog aria-labelledby="changelog-heading" @cancel=${this.#close}>
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

                    <h2 id="changelog-heading">Changelog</h2>

                    ${RELEASES.map(
                        (release) => html`
                            <section class="release">
                                <h3 class="release-head">
                                    <span class="version">v${release.version}</span>
                                    <span class="date">${release.date}</span>
                                </h3>
                                <ul>
                                    ${release.changes.map((change) => html`<li>${change}</li>`)}
                                </ul>
                            </section>
                        `,
                    )}
                </div>
            </dialog>
        `;
    }
}

customElements.define('pt-changelog', PtChangelog);
