/**
 * What has changed in this app, newest release first.
 *
 * The sibling of <pt-about>: About says what this is, and this says what it has been. Both are
 * peripheral, both are opened from the footer's toolbar, and both are built on the native <dialog>
 * for the reason <pt-confirm> is: focus trapping, Escape, and an inert backdrop come from the
 * platform rather than from hand-written key handling.
 *
 * The releases are CHANGELOG.md, read at build time rather than fetched (ADR-0024). A changelog is
 * written by hand at the moment a version ships and is the same for everybody, so it stays in the
 * bundle: a fetch would put a spinner and a failure state in front of prose that is already there.
 */

import { LitElement, css, html } from 'lit';

import changelogText from '../../CHANGELOG.md?raw';
import { controls } from '../styles/controls.js';
import { closeIcon, iconStyle } from '../ui/icons.js';
import { parseChangelog, parseInline } from './changelog-parse.js';

/** Every release, newest first, in the order CHANGELOG.md lists them. Parsed once at import. */
const RELEASES = parseChangelog(changelogText);

/**
 * Draws one change's parsed spans, recursing into the nested ones.
 *
 * The tags are named here rather than interpolated from the node, so the set of elements a
 * changelog can put in the page is this switch and nothing else.
 *
 * @param {import('./changelog-parse.js').InlineNode[]} nodes - Spans of one change.
 * @returns {unknown[]} Strings and templates, in reading order.
 */
function renderInline(nodes) {
    return nodes.map((node) => {
        if ('text' in node) return node.text;

        const children = renderInline(node.children);
        switch (node.tag) {
            case 'strong':
                return html`<strong>${children}</strong>`;
            case 'em':
                return html`<em>${children}</em>`;
            case 'u':
                return html`<u>${children}</u>`;
            case 's':
                return html`<s>${children}</s>`;
            case 'code':
                return html`<code>${children}</code>`;
            default:
                return children;
        }
    });
}

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
                /* Firefox draws the scrollbar from these two; WebKit and Blink ignore them and
                   take the pseudo-element rules below. Both aim at the same bar so the panel
                   scrolls the same on every platform. */
                scrollbar-width: thin;
                scrollbar-color: color-mix(in srgb, var(--ink) 25%, transparent) transparent;
            }

            dialog::-webkit-scrollbar {
                width: 0.5rem;
            }

            dialog::-webkit-scrollbar-track {
                background: transparent;
            }

            dialog::-webkit-scrollbar-thumb {
                border-radius: var(--radius-round);
                background: color-mix(in srgb, var(--ink) 25%, transparent);
            }

            @media (hover: hover) {
                dialog::-webkit-scrollbar-thumb:hover {
                    background: color-mix(in srgb, var(--ink) 40%, transparent);
                }
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
             * The rail and its dots. --rail-x is how far in from a release's left edge the line
             * runs, and --rail-y how far down it the dot sits, which is the middle of the version's
             * line box. Both are this ornament's own geometry rather than anything reusable.
             */
            .timeline {
                --rail-x: 0.5rem;
                --rail-y: 0.75rem;
            }

            /*
             * A release heading is its version and its date on one line, and the version is set in
             * the mono face every machine-readable string in the app takes, the room code above all.
             * It is a fact to be quoted back in a bug report rather than prose.
             */
            .release {
                position: relative;
                padding-left: calc(var(--rail-x) + var(--space-4));
                padding-bottom: var(--space-6);
            }

            .release:last-of-type {
                padding-bottom: 0;
            }

            /*
             * One rail segment per release, running its whole height. The releases are stacked on
             * padding rather than margin so the segments meet and read as a single line.
             */
            .release::before {
                content: '';
                position: absolute;
                top: 0;
                bottom: 0;
                left: calc(var(--rail-x) - 0.75px);
                width: 1.5px;
                background: color-mix(in srgb, var(--accent) 30%, transparent);
            }

            /* The line begins and ends on a dot rather than overshooting the ends of the list. */
            .release:first-of-type::before {
                top: var(--rail-y);
            }

            .release:last-of-type::before {
                bottom: calc(100% - var(--rail-y));
            }

            .dot {
                position: absolute;
                top: var(--rail-y);
                left: var(--rail-x);
                width: 0.625rem;
                height: 0.625rem;
                border-radius: var(--radius-round);
                background: var(--accent);
                transform: translate(-50%, -50%);
            }

            /* A patch release is a smaller stop on the same line: a fix, not a version to read. */
            .dot.fix {
                width: 0.375rem;
                height: 0.375rem;
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

            /* Emphasis takes --ink as well as the weight: bold graphite at --text-sm is a shade
               nobody reads as emphasis, so the word steps forward instead of thickening in place. */
            strong {
                color: var(--ink);
                font-weight: 700;
            }

            u {
                text-underline-offset: 0.15em;
            }

            /*
             * A quoted string in the mono face, which runs large next to the UI face, so it is set
             * back a step. The ground is the faintest wash of ink there is: enough to bound the
             * span, not enough to be a second surface in a dialog that has one.
             */
            code {
                padding: 0.1em 0.3em;
                border-radius: var(--radius-control);
                background: color-mix(in srgb, var(--ink) 6%, transparent);
                font-family: var(--font-mono);
                font-size: 0.9em;
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

                    <div class="timeline">
                        ${RELEASES.map(
                            (release) => html`
                                <section class="release">
                                    <span
                                        class="dot ${release.isPatch ? 'fix' : ''}"
                                        aria-hidden="true"
                                    ></span>
                                    <h3 class="release-head">
                                        <span class="version">${release.version}</span>
                                        <span class="date">${release.date}</span>
                                    </h3>
                                    <ul>
                                        ${release.changes.map(
                                            (change) =>
                                                html`<li>${renderInline(parseInline(change))}</li>`,
                                        )}
                                    </ul>
                                </section>
                            `,
                        )}
                    </div>
                </div>
            </dialog>
        `;
    }
}

customElements.define('pt-changelog', PtChangelog);
