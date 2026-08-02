/**
 * One grid cell: label, value, and pencil marks.
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
        given: { type: Boolean, reflect: true },
        block: { type: Boolean, reflect: true },
        selected: { type: Boolean, reflect: true },
        heavyRight: { type: Boolean, reflect: true, attribute: 'heavy-right' },
        heavyBottom: { type: Boolean, reflect: true, attribute: 'heavy-bottom' },
    };

    static styles = css`
        :host {
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
        }

        :host([heavy-right]) {
            border-right: var(--grid-heavy);
        }

        :host([heavy-bottom]) {
            border-bottom: var(--grid-heavy);
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

        .marks {
            position: absolute;
            right: 3px;
            bottom: 2px;
            left: 3px;
            font-size: var(--text-xs);
            color: var(--pencil);
            text-align: left;
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
            ${
                this.marks?.length
                    ? html`<span class="marks">${this.marks.join(' ')}</span>`
                    : nothing
            }
        `;
    }
}

customElements.define('pt-cell', PtCell);
