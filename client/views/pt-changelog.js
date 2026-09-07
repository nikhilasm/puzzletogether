/**
 * What has changed in this app, newest release first, the sibling of pt-about built on the native
 * dialog like pt-confirm. The releases are CHANGELOG.md read at build time rather than fetched
 * (ADR-0024), since a fetch would put a spinner in front of prose already in the bundle.
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
                /* Firefox draws the scrollbar from these two while WebKit and Blink take the
                   pseudo-element rules below, both aimed at the same bar. */
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

            /* The rail and its dots: --rail-x is how far in the line runs, --rail-y how far down the
               dot sits, both this ornament's own geometry. */
            .timeline {
                --rail-x: 0.5rem;
                --rail-y: 0.75rem;
            }

            /* A release block, padded left of the rail; its version is set in the mono face every
               machine-readable string takes. */
            .release {
                position: relative;
                padding-left: calc(var(--rail-x) + var(--space-4));
                padding-bottom: var(--space-6);
            }

            .release:last-of-type {
                padding-bottom: 0;
            }

            /* One rail segment per release running its whole height, the releases stacked on padding
               so the segments meet as one line. */
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

            /* A quoted string in the mono face, set back a step with the faintest wash of ink to
               bound it. */
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
