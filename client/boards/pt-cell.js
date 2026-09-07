/**
 * One grid cell: label, value, pencil marks, and check feedback. Created once per cell and updated
 * by property assignment, since this element's update cost decides whether a 25×25 grid stays
 * smooth, so render() stays allocation-free (design-spec.md §11).
 */

import { LitElement, css, html, nothing } from 'lit';

export class PtCell extends LitElement {
    static properties = {
        index: { type: Number },
        value: { type: String },
        label: { type: String },
        clue: { type: Object },
        marks: { type: Array },
        markCols: { type: Number },
        markRows: { type: Number },
        glyphs: { type: Object },
        labelRow: { type: Boolean, reflect: true, attribute: 'label-row' },
        check: { type: String, reflect: true },
        given: { type: Boolean, reflect: true },
        block: { type: Boolean, reflect: true },
        selected: { type: Boolean, reflect: true },
        highlighted: { type: Boolean, reflect: true },
        circled: { type: Boolean, reflect: true },
        heavyRight: { type: Boolean, reflect: true, attribute: 'heavy-right' },
        heavyBottom: { type: Boolean, reflect: true, attribute: 'heavy-bottom' },
    };

    static styles = css`
        :host {
            /* Border-box, so aspect-ratio measures the border box and a cell with a heavier region
               border stays the same height as its neighbours. */
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

        /* Region rules are drawn over the hairlines as positioned pseudo-elements rather than
           borders, which would mitre and cut a pale notch at every crossing. */
        :host([heavy-right])::after,
        :host([heavy-bottom])::before {
            content: '';
            position: absolute;
            z-index: 1;
            background: var(--grid-heavy-color);
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

        /* A given square's faint ground; background-color where the washes below are
           background-image, different longhands so the tint and a wash can show at once rather than
           replacing each other. */
        :host([given]) {
            background-color: var(--given-fill);
        }

        /* The square this player's cursor is in, in this player's own --focus-color (published by
           the board, falling back to --accent); the one place a player's colour touches the grid
           surface, never the value written on it (brand.md §3). */
        :host([selected]) {
            background-image: linear-gradient(
                color-mix(in srgb, var(--focus-color) 40%, transparent) 0 100%
            );
        }

        /* The squares the cursor implies, much lighter than the cursor and :not([selected]) so it
           cannot paint over it; a board with a more urgent highlight overrides this (see
           nonogram). */
        :host([highlighted]:not([selected])) {
            background-image: linear-gradient(
                color-mix(in srgb, var(--focus-color) 12%, transparent) 0 100%
            );
        }

        /* The value sizes itself to fit the square: min() shrinks it as it lengthens, max() floors
           that, and past the floor it clips (min-width: 0 is required, or a nowrap flex item's
           min-content width would push the cell wider than its neighbours). */
        .value {
            position: relative;
            z-index: 1;
            overflow: hidden;
            min-width: 0;
            max-width: 100%;
            font-size: max(
                calc(var(--cell-size, 40px) * 0.27),
                min(
                    calc(var(--cell-size, 40px) * 0.55),
                    calc(var(--cell-size, 40px) * 1.35 / var(--value-len, 1))
                )
            );
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            color: var(--ink);
        }

        /* A circled square: a thin --graphite ring, since --ink and --accent already mean an entered
           value and the cursor. */
        .ring {
            position: absolute;
            inset: 8%;
            border: 1px solid var(--graphite);
            border-radius: var(--radius-round);
            pointer-events: none;
        }

        /* Givens carry more weight than entries by font weight and a faint ground, never colour
           (brand.md §3); 700 against 400 because only those two weights are loaded. */
        .value.given {
            font-weight: 700;
        }

        .value.entered {
            font-weight: 400;
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

        /* A nonogram fill, drawn as --ink over the whole square so adjacent fills meet and a run
           reads as one bar the length of its clue. */
        .value.block {
            width: 100%;
            height: 100%;
            background: var(--ink);
        }

        /* The cross is drawn as two SVG strokes sized to the square, not typed, so it is legible
           across a 20×20 and centred by construction rather than on a glyph's off-centre axis. */
        .value.cross {
            width: 55%;
            aspect-ratio: 1;
            color: var(--pencil);
        }

        .value.cross svg {
            display: block;
            width: 100%;
            height: 100%;
            stroke: currentColor;
            stroke-width: 1.5;
            stroke-linecap: round;
        }

        /* Check feedback recolours a mark the same way it recolours a digit. */
        :host([check='correct']) .value.block {
            background: var(--correct);
        }

        :host([check='wrong']) .value.block {
            background: var(--wrong);
        }

        .value.pop {
            animation: pop var(--motion-mark) ease-out;
        }

        /* The entry number, scaled to the cell rather than the page, floored at 7px so a 25×25 keeps
           its numbering and capped at --text-sm. */
        .label {
            position: absolute;
            top: 5%;
            left: 7%;
            font-size: min(var(--text-sm), max(7px, calc(var(--cell-size, 40px) * 0.3)));
            line-height: 1;
            color: var(--graphite);
        }

        /* A label given the mark grid's first row to itself, so a cage clue and the note 1 no
           longer contest the top-left corner, and sized by that track so it scales with the cell. */
        :host([label-row]) .label {
            top: 6%;
            left: 6%;
            font-size: calc((var(--cell-size, 40px) * 0.88) / var(--mark-rows, 4) * 0.86);
            line-height: 1;
        }

        /* A kakuro clue square: two sums drawn as its own full-size layer, split by a gradient
           diagonal (CSS has no diagonal border), each sum on the side its run leaves by so it reads
           as the right clue on the run. */
        .clue {
            position: absolute;
            inset: 0;
            background: linear-gradient(
                to top right,
                transparent calc(50% - 0.5px),
                color-mix(in srgb, var(--paper) 55%, transparent) calc(50% - 0.5px),
                color-mix(in srgb, var(--paper) 55%, transparent) calc(50% + 0.5px),
                transparent calc(50% + 0.5px)
            );
            pointer-events: none;
        }

        /* Sized off the cell and floored so a 13×13 on a phone still has legible sums, slightly
           larger than a label since these two numbers are the whole content of the square. */
        .clue span {
            position: absolute;
            font-size: min(var(--text-sm), max(7px, calc(var(--cell-size, 40px) * 0.34)));
            line-height: 1;
            color: var(--paper);
            font-variant-numeric: tabular-nums;
        }

        .clue .across {
            top: 7%;
            right: 9%;
        }

        .clue .down {
            bottom: 7%;
            left: 9%;
        }

        /* Marks sit in fixed positions, both axes declared so adding or removing one does not
           re-lay out the others; --mark-rows is published on the host so the label, positioned by
           the same track height, can read it. */
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

        /* With a row given to the label, marks are sized by their track so a full set still fits the
           rows left. */
        :host([label-row]) .marks {
            font-size: calc((var(--cell-size, 40px) * 0.88) / var(--mark-rows, 4) * 0.78);
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
        this.clue = null;
        this.marks = [];
        this.markCols = 3;
        this.markRows = 3;
        this.glyphs = null;
        this.labelRow = false;
        this.check = null;
        this.given = false;
        this.block = false;
        this.selected = false;
        this.highlighted = false;
        this.circled = false;
        this.heavyRight = false;
        this.heavyBottom = false;
    }

    /** Rows in the mark grid, counting the one the label has been given. */
    get #gridRows() {
        return this.markRows + (this.labelRow ? 1 : 0);
    }

    /**
     * Publishes the mark grid's shape on the host, where the label, not inside .marks, can read it
     * too. Guarded since this element's per-update cost decides whether a 25×25 stays smooth, and
     * the grid's shape is written once.
     */
    willUpdate(changed) {
        if (!changed.has('markCols') && !changed.has('markRows') && !changed.has('labelRow'))
            return;
        this.style.setProperty('--mark-cols', `${this.markCols}`);
        this.style.setProperty('--mark-rows', `${this.#gridRows}`);
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
            ${this.circled ? html`<span class="ring" aria-hidden="true"></span>` : nothing}
            ${this.clue ? this.#renderClue() : nothing}
            ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
            ${this.value != null ? this.#renderValue() : nothing}
            ${this.value == null && this.marks?.length ? this.#renderMarks() : nothing}
        `;
    }

    /**
     * The pair of sums on a clue square, either side of its diagonal.
     *
     * Hidden from a screen reader, which is told the same thing better: the board composes the whole
     * square into one phrase on the cell, so reading these two numbers loose would say them twice
     * and say neither of them as a clue.
     */
    #renderClue() {
        return html`
            <span class="clue" aria-hidden="true">
                ${
                    this.clue.across != null
                        ? html`<span class="across">${this.clue.across}</span>`
                        : nothing
                }
                ${
                    this.clue.down != null
                        ? html`<span class="down">${this.clue.down}</span>`
                        : nothing
                }
            </span>
        `;
    }

    /**
     * The cell's value, as a character or as a mark.
     *
     * glyphs maps a value to how it is drawn, and a value the map does not mention is drawn as
     * itself, so a puzzle that supplies no map gets characters, which is every type but nonogram.
     */
    #renderValue() {
        const glyph = this.glyphs?.[this.value];
        if (glyph === 'block') return html`<span class="value block"></span>`;
        if (glyph === 'cross') {
            return html`<span class="value cross"
                ><svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M1 1 L9 9 M9 1 L1 9" fill="none" />
                </svg>
            </span>`;
        }

        // The length drives the size-to-fit rule above. Written as a custom property rather than a
        // computed font-size so the arithmetic stays in the stylesheet with the rest of the geometry.
        return html`<span
            class="value ${this.given ? 'given' : 'entered'}"
            style="--value-len: ${this.value.length}"
            >${this.value}</span
        >`;
    }

    /** The pencil marks, each placed at the position its digit always occupies. */
    #renderMarks() {
        const offset = this.labelRow ? 1 : 0;

        return html`
            <span class="marks" aria-hidden="true">
                ${this.marks.map((mark) => {
                    const slot = mark - 1;
                    const row = Math.floor(slot / this.markCols) + 1 + offset;
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
