/**
 * Every clue, Across and Down, over the grid.
 *
 * A dialog rather than a panel beside the board (design-spec.md §4): two scrolling lists and a 15×15
 * do not fit a phone together, and on the desktop column they would take the grid's width to show
 * something a solver reads once per entry. The cost is that scanning for a way in becomes a tap
 * rather than a glance, which is exactly what the always-visible clue bar is there to offset.
 *
 * Built on the native `<dialog>`, like `<pt-confirm>`, so focus trapping, Escape, and the inert
 * backdrop come from the platform rather than from hand-written key handling.
 *
 * Holds nothing: it is given the entries and the current one, and reports which clue was picked.
 */

import { LitElement, css, html, nothing } from 'lit';

import { controls, focusRing } from '../styles/controls.js';

import { closeIcon, iconStyle } from './icons.js';

export class PtClueList extends LitElement {
    static properties = {
        open: { type: Boolean },
        entries: { type: Array },
        current: { type: Object },
        /** Cell values, so a finished entry can be struck through. */
        filled: { type: Object },
    };

    static styles = [
        controls,
        focusRing,
        iconStyle,
        css`
            dialog {
                /*
                 * Nearly the whole viewport. This is a reading surface — the point of opening it is
                 * to see as many clues at once as possible, so the usual modal restraint would be
                 * working against the only reason it exists.
                 */
                width: min(48rem, 94vw);
                max-width: none;
                height: min(80vh, 44rem);
                padding: 0;
                border: var(--border);
                border-radius: var(--radius-modal);
                background: var(--paper-raised);
                color: var(--ink);
                box-shadow: var(--shadow-modal);
            }

            /*
             * dialog[open], never bare dialog.
             *
             * The UA stylesheet hides a closed dialog with dialog:not([open]) { display: none },
             * and an author display on dialog beats it outright — origin wins over specificity —
             * so styling the bare selector would leave the clue list on screen permanently.
             *
             * Flex rather than the calc(100% - 4.5rem) this used to give .lists: that number was
             * the head's height written down twice, and it was already wrong by a few pixels once
             * the head's padding changed.
             */
            dialog[open] {
                display: flex;
                flex-direction: column;
            }

            dialog::backdrop {
                background: color-mix(in srgb, var(--ink) 40%, transparent);
            }

            /*
             * One padding value for the head and the columns, so the heading, the column headings,
             * and the clues all start on the same left edge.
             *
             * They did not. Both used var(--space-5), and there is no --space-5 in the scale —
             * it goes 1, 2, 3, 4, 6, 8, 12. An undefined custom property with no fallback makes the
             * whole declaration invalid at computed-value time, so padding fell back to its
             * initial 0 and the dialog had no inset at all on either box. The inconsistency was the
             * .head and .column boxes each losing a *different* padding to the same typo.
             */
            .head {
                display: flex;
                flex: none;
                align-items: center;
                justify-content: space-between;
                gap: var(--space-3);
                padding: var(--space-4);
            }

            h2 {
                margin: 0;
                font-family: var(--font-display);
                font-size: var(--text-lg);
                font-weight: 600;
            }

            /*
             * Borderless, like the About dialog's. A dismissal is not an action to be weighed, and a
             * framed button in the corner of a reading surface reads as one more thing on the page.
             */
            .close {
                display: flex;
                flex: none;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                min-height: 2.25rem;
                padding: 0;
                border: none;
                background: none;
                color: var(--graphite);
            }

            .close:hover {
                color: var(--ink);
            }

            /*
             * Two columns where there is room, one where there is not.
             *
             * **No rule between them, and none under the head.** Three hairlines in a box this size
             * cut a reading surface into panes, and none of them was doing work the whitespace was
             * not already doing — the Across and Down headings say where one list ends. The dialog's
             * own border is the only line here now.
             */
            .lists {
                display: grid;
                flex: 1;
                grid-template-columns: 1fr 1fr;
                gap: 0 var(--space-4);
                min-height: 0;
                padding: 0 var(--space-4) var(--space-4);
                overflow: hidden;
            }

            .column {
                overflow-y: auto;
                min-width: 0;
            }

            h3 {
                position: sticky;
                top: 0;
                margin: 0 0 var(--space-2);
                padding-bottom: var(--space-2);
                background: var(--paper-raised);
                color: var(--graphite);
                font-family: var(--font-ui);
                font-size: var(--text-sm);
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }

            ol {
                margin: 0;
                padding: 0;
                list-style: none;
            }

            /*
             * align-items: center, which is what was missing.
             *
             * A flex row defaults to stretch, so the number and the clue were each as tall as the
             * button and their text sat at the top of that box. On a one-line clue nothing showed;
             * on a clue that wrapped to two, the number hung at the first line while the row's own
             * padding centred nothing, and every row in the list looked differently aligned.
             * Centring the items is right for the number — it should sit against the *clue*, not
             * against the clue's first line — and align-self puts it back to the top where the
             * clue is long enough for that to matter more.
             */
            li button {
                display: flex;
                gap: var(--space-3);
                align-items: center;
                width: 100%;
                min-height: 2.25rem;
                padding: var(--space-2);
                border: none;
                border-radius: var(--radius-control);
                background: none;
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-base);
                line-height: 1.4;
                text-align: left;
                cursor: pointer;
            }

            li button:hover {
                background: color-mix(in srgb, var(--accent) 10%, transparent);
            }

            /*
             * The entry the cursor is in, marked the same way the grid marks it — the accent wash.
             * Someone glancing between the grid and this list should not have to learn two
             * vocabularies for "you are here".
             */
            li button[aria-current='true'] {
                background: color-mix(in srgb, var(--accent) 20%, transparent);
                font-weight: 700;
            }

            .num {
                flex-shrink: 0;
                align-self: flex-start;
                min-width: 1.75rem;
                color: var(--accent);
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }

            /* Only the number is pinned to the top; a wrapped clue reads from its own first line. */
            .text {
                min-width: 0;
            }

            /*
             * A finished entry fades rather than disappearing. It is still a clue, and a solver
             * re-reads the ones they have answered when a crossing goes wrong.
             */
            li button[data-done] .text {
                color: var(--graphite);
            }

            @media (max-width: 40rem) {
                .lists {
                    grid-template-columns: 1fr;
                    overflow-y: auto;
                }

                .column {
                    overflow: visible;
                }

                /* Stacked, the two lists need the space between them the gap was giving them
                   side by side. Their headings do the dividing, as they do in two columns. */
                .column + .column {
                    margin-top: var(--space-4);
                }
            }
        `,
    ];

    constructor() {
        super();
        this.open = false;
        this.entries = [];
        this.current = null;
        this.filled = {};
    }

    /**
     * Opens and closes the real dialog, and scrolls the current clue into view once it is showing.
     *
     * The scroll is the reason this list is worth opening on a 15×15: 78 clues is several screens,
     * and landing at the top every time would mean hunting for where you already were.
     */
    updated(changed) {
        if (!changed.has('open') && !changed.has('current')) return;

        const dialog = this.renderRoot.querySelector('dialog');
        if (!dialog) return;
        if (this.open && !dialog.open) dialog.showModal();
        if (!this.open && dialog.open) dialog.close();
        if (!this.open) return;

        this.renderRoot
            .querySelector('[aria-current="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }

    /** Reports a pick or a dismissal; the screen above owns `open`. */
    #emit(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    render() {
        return html`
            <dialog aria-labelledby="clues-heading" @cancel=${() => this.#emit('pt-clues-close')}>
                <div class="head">
                    <h2 id="clues-heading">Clues</h2>
                    <button
                        class="close"
                        type="button"
                        aria-label="Close"
                        title="Close"
                        @click=${() => this.#emit('pt-clues-close')}
                    >
                        ${closeIcon}
                    </button>
                </div>
                <div class="lists">
                    ${this.#renderColumn('Across', 'A')} ${this.#renderColumn('Down', 'D')}
                </div>
            </dialog>
        `;
    }

    /** One direction's clues, in numbering order. */
    #renderColumn(heading, dir) {
        const entries = (this.entries ?? []).filter((entry) => entry.dir === dir);
        if (entries.length === 0) return nothing;

        return html`
            <div class="column">
                <h3>${heading}</h3>
                <ol>
                    ${entries.map((entry) => this.#renderClue(entry))}
                </ol>
            </div>
        `;
    }

    /** One clue. Picking it moves the cursor to the entry's first unfilled square. */
    #renderClue(entry) {
        const isCurrent = this.current?.num === entry.num && this.current?.dir === entry.dir;
        const isDone = entry.cells.every((cell) => this.filled?.[cell] != null);

        return html`
            <li>
                <button
                    type="button"
                    aria-current=${isCurrent ? 'true' : 'false'}
                    ?data-done=${isDone}
                    @click=${() => this.#emit('pt-clue-pick', { entry })}
                >
                    <span class="num">${entry.num}</span>
                    <span class="text">${entry.clue}</span>
                </button>
            </li>
        `;
    }
}

customElements.define('pt-clue-list', PtClueList);
