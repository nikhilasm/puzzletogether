/**
 * One grid cell: label, value, pencil marks, and check feedback.
 *
 * Created once per cell and updated by property assignment, never re-created — this is the element
 * whose update cost decides whether a 25×25 grid stays smooth (design-spec.md §11). Everything in
 * `render()` here runs `rows * cols` times, so it stays allocation-free.
 */

import { LitElement, css, html, nothing } from 'lit';

export class PtCell extends LitElement {
    static properties = {
        index: { type: Number },
        value: { type: String },
        label: { type: String },
        marks: { type: Array },
        markCols: { type: Number },
        markRows: { type: Number },
        check: { type: String, reflect: true },
        given: { type: Boolean, reflect: true },
        block: { type: Boolean, reflect: true },
        selected: { type: Boolean, reflect: true },
        heavyRight: { type: Boolean, reflect: true, attribute: 'heavy-right' },
        heavyBottom: { type: Boolean, reflect: true, attribute: 'heavy-bottom' },
    };

    static styles = css`
        :host {
            /*
             * Border-box, and every cell keeps the same 1px hairlines whatever its region borders
             * are. Under content-box, aspect-ratio measured the content box, so a cell carrying a
             * 2.5px region border came out shorter than its neighbours — which is the 1px vertical
             * misalignment Firefox showed and Chromium mostly rounded away.
             */
            box-sizing: border-box;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            aspect-ratio: 1;
            border-right: var(--grid-hairline);
            border-bottom: var(--grid-hairline);
            border-radius: var(--radius-grid);
            font-family: var(--font-ui);
            line-height: 1;
            cursor: pointer;
            user-select: none;
            /* Stops a double-tap on the grid zooming the page on iOS. */
            touch-action: manipulation;
        }

        /*
         * Region rules are drawn *over* the hairlines rather than replacing them. As borders they
         * mitred with the same cell's hairline on the adjoining edge, which cut a pale notch across
         * the heavy rule at every crossing — the subdivision showing through the major division.
         * A positioned pseudo-element paints after the element's own borders, so it covers that
         * corner, and it costs the cell no geometry.
         */
        :host([heavy-right])::after,
        :host([heavy-bottom])::before {
            content: '';
            position: absolute;
            z-index: 1;
            background: var(--ink);
            pointer-events: none;
        }

        :host([heavy-right])::after {
            top: 0;
            right: -1px;
            width: var(--grid-heavy-width);
            height: calc(100% + 1px);
        }

        :host([heavy-bottom])::before {
            bottom: -1px;
            left: 0;
            width: calc(100% + 1px);
            height: var(--grid-heavy-width);
        }

        :host([block]) {
            background: var(--ink);
            cursor: default;
        }

        :host([selected]) {
            background: color-mix(in srgb, var(--accent) 16%, transparent);
        }

        .value {
            font-size: calc(var(--cell-size, 40px) * 0.55);
            font-variant-numeric: tabular-nums;
            color: var(--ink);
        }

        /*
         * Givens carry more weight than entries. The difference is weight, never colour: attribution
         * lives in chips and presence dots, and an entered digit is always --ink (brand.md §3).
         */
        .value.given {
            font-weight: 700;
        }

        .value.entered {
            font-weight: 500;
        }

        /*
         * Check feedback is the one thing allowed to recolour a value, and it is transient: any
         * edit to the cell retires the mark (design-spec.md §4).
         */
        :host([check='correct']) .value {
            color: var(--correct);
        }

        :host([check='wrong']) .value {
            color: var(--wrong);
        }

        .value.pop {
            animation: pop var(--motion-mark) ease-out;
        }

        .label {
            position: absolute;
            top: 2px;
            left: 3px;
            font-size: var(--text-sm);
            color: var(--graphite);
        }

        /*
         * Marks sit in fixed positions so a digit is always in the same corner of every cell, which
         * is what makes a grid of notes scannable. Size derives from the cell, like the value does.
         *
         * Both axes are declared. With only the columns named, the rows were implicit and sized to
         * whatever happened to be in them, so adding or removing a mark re-laid out the others —
         * exactly the shifting the fixed positions exist to prevent.
         */
        .marks {
            position: absolute;
            inset: 0;
            display: grid;
            grid-template-columns: repeat(var(--mark-cols, 3), 1fr);
            grid-template-rows: repeat(var(--mark-rows, 3), 1fr);
            align-items: center;
            justify-items: center;
            padding: 6%;
            font-size: calc(var(--cell-size, 40px) * 0.26);
            color: var(--pencil);
            line-height: 1;
            pointer-events: none;
        }

        @keyframes pop {
            from {
                transform: scale(0.85);
            }
            to {
                transform: scale(1);
            }
        }
    `;

    constructor() {
        super();
        this.index = 0;
        this.value = null;
        this.label = null;
        this.marks = [];
        this.markCols = 3;
        this.markRows = 3;
        this.check = null;
        this.given = false;
        this.block = false;
        this.selected = false;
        this.heavyRight = false;
        this.heavyBottom = false;
    }

    /** Pops the value when it changes, so a mark lands rather than fades (brand.md §5). */
    updated(changed) {
        if (!changed.has('value') || this.value == null) return;
        const element = this.renderRoot.querySelector('.value');
        if (!element) return;
        element.classList.remove('pop');
        // Reading offsetWidth restarts the animation when the same class is re-added.
        void element.offsetWidth;
        element.classList.add('pop');
    }

    render() {
        return html`
            ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
            ${
                this.value != null
                    ? html`<span class="value ${this.given ? 'given' : 'entered'}"
                          >${this.value}</span
                      >`
                    : nothing
            }
            ${this.value == null && this.marks?.length ? this.#renderMarks() : nothing}
        `;
    }

    /** The pencil marks, each placed at the position its digit always occupies. */
    #renderMarks() {
        return html`
            <span
                class="marks"
                style="--mark-cols: ${this.markCols}; --mark-rows: ${this.markRows};"
                aria-hidden="true"
            >
                ${this.marks.map((mark) => {
                    const slot = mark - 1;
                    const row = Math.floor(slot / this.markCols) + 1;
                    const col = (slot % this.markCols) + 1;
                    return html`<span style="grid-row: ${row}; grid-column: ${col};"
                        >${mark}</span
                    >`;
                })}
            </span>
        `;
    }
}

customElements.define('pt-cell', PtCell);
