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

        :host([selected]) {
            background: color-mix(in srgb, var(--accent) 16%, transparent);
        }

        /*
         * A cell a gesture in progress has reached but not yet committed to.
         *
         * The same accent wash the selected cell uses, and deeper, because a drag is a stronger
         * statement of intent than a cursor resting somewhere — the point of showing it is to answer
         * "how far have I got?" while the finger is still down, which needs to be legible over the
         * marks already in the run.
         */
        :host([highlighted]) {
            background: color-mix(in srgb, var(--accent) 30%, transparent);
        }

        /*
         * The value sizes itself to fit the square, which for one character is just the old fixed
         * proportion and for a crossword rebus square is the whole point (ADR-0007).
         *
         * Read outward: min() shrinks the text as it lengthens, so HAND fits the same box H did;
         * max() puts a floor under that, because past about five characters shrinking to fit stops
         * being legibility and starts being a dare. Beyond the floor the text is clipped rather than
         * wrapped — the whole string is still in the cell's aria-label, and a square that grew a
         * second line would break the grid's geometry for every cell in its row.
         */
        .value {
            position: relative;
            z-index: 1;
            overflow: hidden;
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

        /*
         * A circled square: an annotation, not a rule.
         *
         * Themed crosswords hide a bonus answer in these, so they have to be visible, but they play
         * exactly like every other square — which is why this is a thin --graphite ring rather than
         * anything in --ink or --accent. Both of those already mean something here: --ink is a value
         * the player entered, and --accent is where the cursor is.
         */
        .ring {
            position: absolute;
            inset: 8%;
            border: 1px solid var(--graphite);
            border-radius: var(--radius-round);
            pointer-events: none;
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

        /*
         * A value drawn as a mark rather than as a character, for puzzles whose cells are not
         * lettered — nonogram's filled squares and crosses. Which value draws as which is the
         * board's business, via its glyphs map; what each one looks like is this element's.
         *
         * The colours are the ones the app already uses for the same ideas: a fill is an answer, so
         * it is --ink like every entered value, and a cross is a note about where the picture is
         * not, so it is --pencil like every other note.
         *
         * A fill takes the whole square rather than sitting inside it. Adjacent fills then meet, so
         * a run reads as one bar the length of its clue — which is the thing a solver is counting.
         * Inset blocks read as a row of separate dots and have to be counted one at a time. The
         * hairlines stay visible over the top, so the grid is still a grid.
         */
        .value.block {
            width: 100%;
            height: 100%;
            background: var(--ink);
        }

        /*
         * The cross is sized to the square, not to the type scale around it.
         *
         * It is a mark on a grid rather than a character in a sentence: at text proportions it read
         * as a small dot in a large empty cell, which is exactly what an unmarked cell looks like
         * from arm's length. It has to be legible at a glance across a 20×20 to be worth making.
         */
        .value.cross {
            color: var(--pencil);
            font-size: calc(var(--cell-size, 40px) * 0.92);
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

        /*
         * The entry number, sized and placed by the square it sits in rather than by the page.
         *
         * It used to be a flat --text-sm at a flat 2px inset, which is fine at the 40px cells a
         * mini gets and wrong everywhere else — a 15×15 on a phone is 19px squares, where 12.8px of
         * number is two thirds the height of the cell. It swamped the letter underneath and, because
         * a fixed 2px inset is a different *proportion* in every grid, the numbers stopped reading as
         * a column down the left edge and started looking scattered. Both complaints were really one
         * measurement.
         *
         * Read outward: it scales with the cell, floors at 7px so a 25×25 does not lose its numbering
         * altogether, and is capped at the old size so no grid gets a number *larger* than before.
         */
        .label {
            position: absolute;
            top: 5%;
            left: 7%;
            font-size: min(var(--text-sm), max(7px, calc(var(--cell-size, 40px) * 0.3)));
            line-height: 1;
            color: var(--graphite);
        }

        /*
         * A label with a row of the mark grid to itself.
         *
         * A cage clue and the note "1" both want the cell's top-left corner — the clue because that
         * is where a clue goes, the note because a mark's position *is* its digit — and the marks
         * paint last, so a full set of notes simply covered the clue. Stacking them was never going
         * to work at cell sizes this small, so the board can instead reserve the grid's first row:
         * the clue takes it, the notes start one row lower, and the two can no longer meet whatever
         * is written in the cell.
         *
         * The clue is then sized by the track it occupies rather than by the page's type scale. It
         * was the only thing in a cell that did not scale with --cell-size, which meant it grew
         * relative to everything around it exactly where the room was tightest: at a 7×7 on a phone
         * the notes were down to 11px and the clue was still 12.8px.
         */
        :host([label-row]) .label {
            top: 6%;
            left: 6%;
            font-size: calc((var(--cell-size, 40px) * 0.88) / var(--mark-rows, 4) * 0.86);
            line-height: 1;
        }

        /*
         * Marks sit in fixed positions so a digit is always in the same corner of every cell, which
         * is what makes a grid of notes scannable. Size derives from the cell, like the value does.
         *
         * Both axes are declared. With only the columns named, the rows were implicit and sized to
         * whatever happened to be in them, so adding or removing a mark re-laid out the others —
         * exactly the shifting the fixed positions exist to prevent.
         *
         * --mark-rows counts the grid's rows, which is one more than the rows of *marks* when a
         * label has been given one. It is published on the host rather than set here, because the
         * label is positioned by the same track height and is not inside this container.
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

        /*
         * With a row given away, the marks are sized by their track rather than by the cell, so a
         * full set still fits in the rows that are left. Without this a 7×7's three rows of notes
         * kept their 26% and overflowed into each other.
         */
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
     * Publishes the mark grid's shape on the host, where the label can read it too.
     *
     * The label is placed by the same track height as the marks it shares the grid with, and it is
     * not inside `.marks` — that container only exists when the cell has notes, while a cage clue is
     * drawn whether it does or not. A custom property on the host is the one place both rules reach.
     *
     * Guarded, because this is the element whose per-update cost decides whether a 25×25 stays
     * smooth: the grid's shape is fixed by the puzzle, so it is written once and then never again.
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
            ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
            ${this.value != null ? this.#renderValue() : nothing}
            ${this.value == null && this.marks?.length ? this.#renderMarks() : nothing}
        `;
    }

    /**
     * The cell's value, as a character or as a mark.
     *
     * `glyphs` maps a value to how it is drawn, and a value the map does not mention is drawn as
     * itself — so a puzzle that supplies no map gets characters, which is every type but nonogram.
     */
    #renderValue() {
        const glyph = this.glyphs?.[this.value];
        if (glyph === 'block') return html`<span class="value block"></span>`;
        if (glyph === 'cross') return html`<span class="value cross">×</span>`;

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
