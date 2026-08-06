/**
 * Base element for every puzzle grid: geometry, cell DOM, selection, the presence layer, and
 * input.
 *
 * Subclasses supply only cell decoration and input filtering (design-spec.md §7). A fifth puzzle
 * type should be one server module plus one subclass of this — if it ever needs a change *here*,
 * the abstraction is wrong.
 */

import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { effectiveValue, isEditable, toCoords } from '../../shared/puzzle-doc.js';
import { focusRing } from '../styles/controls.js';

import './pt-cell.js';
import './pt-presence-layer.js';

/** Arrow keys, as row and column deltas. */
const ARROWS = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
};

export class PtBoard extends LitElement {
    static properties = {
        doc: { type: Object },
        board: { type: Object },
        focus: { type: Object },
        players: { type: Array },
        selfId: { type: String },
        selection: { type: Number },
        interactive: { type: Boolean },
        checkResults: { type: Object },
    };

    static styles = [
        focusRing,
        css`
            :host {
                display: block;
                width: 100%;
            }

            /*
             * The grid, with room above and to its left for anything a puzzle draws alongside it.
             *
             * Both gutter tracks are min-content, so a type that draws nothing in them — every type
             * but nonogram — collapses them to nothing and lays out exactly as it did before they
             * existed. That is what lets one layout serve both cases without a flag.
             */
            .layout {
                display: grid;
                grid-template-columns: min-content 1fr;
                grid-template-rows: min-content 1fr;
            }

            /*
             * Gutter contents have to line up with the grid's tracks, and the grid is not flush with
             * the frame: it sits inside the heavy border, and it hangs 1px past the right and bottom
             * edges because cells drop their trailing hairline. Both gutters reproduce that offset
             * exactly rather than approximating it — a clue column half a cell off its grid column
             * is not a cosmetic problem in a nonogram, it is an unreadable puzzle.
             */
            .gutter-top,
            .gutter-side {
                display: grid;
            }

            /*
             * minmax(0, 1fr) rather than 1fr, whose implied auto minimum lets the contents set
             * the track size. A gutter has to fit the grid it labels, never the other way round: the
             * grid's geometry comes from its cells being square, and a clue that will not fit has to
             * shrink or clip rather than push a column wider than the squares beneath it.
             */
            .gutter-top {
                grid-template-columns: repeat(var(--gutter-tracks, 1), minmax(0, 1fr));
                width: calc(100% - 2 * var(--grid-frame-width) + 1px);
                margin-left: var(--grid-frame-width);
            }

            .gutter-side {
                grid-template-rows: repeat(var(--gutter-tracks, 1), minmax(0, 1fr));
                height: calc(100% - 2 * var(--grid-frame-width) + 1px);
                margin-top: var(--grid-frame-width);
            }

            /*
             * The grid is opaque. The page's graph-paper texture is meant to be the surface the
             * puzzle sits *on*, and letting it show through the cells put a second, unaligned grid
             * inside the real one — faint, but exactly the kind of ruling the eye tries to read.
             *
             * On the frame rather than on each cell, so the selection and stroke washes still
             * composite over one flat backdrop instead of over a colour of their own.
             */
            .frame {
                position: relative;
                background: var(--paper);
                border: var(--grid-heavy);
                border-radius: var(--radius-grid);
            }

            .grid {
                display: grid;
                touch-action: manipulation;
                /*
                 * The grid's own hairlines and the frame's heavy border would double up on the last
                 * row and column, so cells drop their trailing edge.
                 */
                margin: 0 -1px -1px 0;
            }

            /* Clicking a square focuses the grid; only keyboard focus should draw a ring. */
            .grid:focus:not(:focus-visible) {
                outline: none;
            }

            /* Colour comes from the shared ring; this only pushes it clear of the heavy frame. */
            .grid:focus-visible {
                outline-offset: 3px;
            }
        `,
    ];

    #resizeObserver = null;

    constructor() {
        super();
        this.doc = null;
        this.board = { seq: 0, cells: {} };
        this.focus = {};
        this.players = [];
        this.selfId = null;
        this.selection = null;
        this.interactive = true;
        this.checkResults = {};
    }

    /**
     * How many columns pencil marks are laid out in, so a digit always sits in the same corner.
     * Subclasses override when their alphabet is not a square.
     *
     * @returns {number} Column count for the mark grid.
     */
    get markColumns() {
        return 3;
    }

    /**
     * How many rows that mark grid has. Declared rather than left implicit, so a mark's position
     * does not depend on which other marks happen to be in the cell.
     *
     * @returns {number} Row count for the mark grid.
     */
    get markRows() {
        return 3;
    }

    /**
     * Whether a cell's label takes the mark grid's first row to itself, pushing the notes down a
     * row. For types whose cells carry a clue as well as notes, which the two would otherwise
     * contest — the clue is drawn in the top-left corner, and so is the note "1".
     *
     * @returns {boolean} True to reserve a row for the label.
     */
    get reservesLabelRow() {
        return false;
    }

    /**
     * Tracks the grid's rendered width so everything in the board can size itself from it.
     *
     * Measured on the grid but **published on the host**, because the gutters are not inside the
     * grid and they need it too. Set on the grid, a nonogram's clues never saw it and fell back to
     * the declared default — which at 20×20 on a phone sized twenty clue rows for a 40px cell and
     * stretched the frame half again as tall as the squares inside it.
     */
    firstUpdated() {
        const grid = this.renderRoot.querySelector('.grid');
        if (!grid || typeof ResizeObserver === 'undefined') return;

        this.#resizeObserver = new ResizeObserver(([entry]) => {
            const cols = this.doc?.size.cols ?? 1;
            this.style.setProperty('--cell-size', `${entry.contentRect.width / cols}px`);
        });
        this.#resizeObserver.observe(grid);
    }

    /** Stops observing when the board leaves the page. */
    disconnectedCallback() {
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        super.disconnectedCallback();
    }

    /**
     * Whether the cell's right edge is a region boundary. Subclasses override to draw the heavy
     * lines that carry the puzzle's structure.
     *
     * @param {number} _idx - Cell index.
     * @returns {boolean} True to draw a heavy right border.
     */
    isHeavyRight(_idx) {
        return false;
    }

    /**
     * Whether the cell's bottom edge is a region boundary.
     *
     * @param {number} _idx - Cell index.
     * @returns {boolean} True to draw a heavy bottom border.
     */
    isHeavyBottom(_idx) {
        return false;
    }

    /**
     * Maps a keystroke to a cell value, filtering input to what this puzzle type accepts.
     *
     * @param {string} _key - The `KeyboardEvent.key` value.
     * @returns {string|null} The value to write, or null when the key means nothing here.
     */
    valueForKey(_key) {
        return null;
    }

    /**
     * How each cell value is drawn, for puzzles whose cells hold marks rather than characters.
     *
     * @returns {Object<string, string>|null} Value to `'block'` or `'cross'`, or null to draw every
     *   value as the character it is.
     */
    get valueGlyphs() {
        return null;
    }

    /**
     * How a cell's label should be *said*, when that differs from how it is drawn.
     *
     * A label is written to be read in a corner a few pixels across, which is not the same job as
     * being read aloud: a kenken clue leans on operator symbols a screen reader may drop or name
     * oddly, and a crossword's bare number needs saying what it numbers. The base returns the label
     * untouched, so a type whose label already reads as a sentence supplies nothing.
     *
     * Only the subclass knows what the label *means*, so it composes the whole phrase — this element
     * has no business knowing that kenken's labels describe cages.
     *
     * @param {string} label - The label as drawn in the cell.
     * @param {number} _idx - The cell the label is drawn in, for types whose label describes the
     *   square's place in the puzzle rather than its contents — a crossword number means "entries
     *   start here", which the label alone cannot say. KenKen ignores it.
     * @returns {string} What a screen reader should say in its place.
     */
    spokenLabel(label, _idx) {
        return label;
    }

    /**
     * Whether the square is annotated rather than special — a ring drawn on it, carrying no rule.
     *
     * Crossword's circled squares are the case: a themed puzzle usually hides a bonus answer in
     * them, so they must be visible, but they behave exactly like every other square.
     *
     * @param {number} _idx - Cell index.
     * @returns {boolean} True to draw the ring.
     */
    isCircled(_idx) {
        return false;
    }

    /**
     * Where an arrow key lands, given where it started and which way it pointed.
     *
     * The default is the adjacent square, stopping at the edges — which was hard-coded here until
     * Phase 4, because for three puzzle types moving the cursor is not a puzzle-specific act. A
     * crossword disagrees twice over: it has squares an arrow must skip, and pressing across the
     * direction you are working means "turn", not "move one".
     *
     * A subclass may change its own state here, which is how the direction flip happens.
     *
     * @param {number} from - Cell the selection is leaving.
     * @param {number} deltaRow - -1, 0, or 1.
     * @param {number} deltaCol - -1, 0, or 1.
     * @returns {number|null} The cell to select, or null to stay put.
     */
    nextSelection(from, deltaRow, deltaCol) {
        const size = this.doc.size;
        const { row, col } = toCoords(from, size);
        const nextRow = Math.min(size.rows - 1, Math.max(0, row + deltaRow));
        const nextCol = Math.min(size.cols - 1, Math.max(0, col + deltaCol));
        return nextRow * size.cols + nextCol;
    }

    /**
     * Where the cursor goes once a value has been written into a square, or nowhere.
     *
     * Nowhere is the right answer for every type that fills a grid in no particular order: a sudoku
     * player picks the square they have worked out, and moving them off it afterwards would be the
     * board second-guessing them. A crossword is read along an entry, so it advances.
     *
     * @param {number} _idx - The cell just written to.
     * @returns {number|null} The next cell, or null to leave the selection alone.
     */
    advanceAfterInput(_idx) {
        return null;
    }

    /**
     * Whether a cell is part of what the player is currently reaching for, as opposed to what they
     * have already written.
     *
     * Distinct from selection, which is one cell and survives between gestures. This is the *extent*
     * of something in progress — the run a nonogram drag has covered so far, and the entry a
     * crossword will highlight around the cursor.
     *
     * @param {number} _idx - Cell index.
     * @returns {boolean} True to wash the cell as part of the current gesture.
     */
    isHighlighted(_idx) {
        return false;
    }

    /**
     * What this puzzle draws above its grid, aligned to the columns — nonogram's column clues.
     *
     * @returns {unknown} A template, or nothing.
     */
    renderTopGutter() {
        return nothing;
    }

    /**
     * What this puzzle draws to the left of its grid, aligned to the rows.
     *
     * @returns {unknown} A template, or nothing.
     */
    renderSideGutter() {
        return nothing;
    }

    /** Moves the selection by a row/column delta, by whatever rule this puzzle navigates on. */
    #moveSelection(deltaRow, deltaCol) {
        const next = this.nextSelection(this.selection ?? 0, deltaRow, deltaCol);
        if (next != null) this.#select(next);
    }

    /** Announces a selection change; the store owns selection, this element only requests it. */
    #select(cell) {
        this.dispatchEvent(
            new CustomEvent('pt-cell-select', { detail: { cell }, bubbles: true, composed: true }),
        );
    }

    /** Routes physical-keyboard input; the keypad and touch reach the same store methods. */
    #onKeyDown(event) {
        if (!this.doc) return;

        if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.dispatchEvent(new CustomEvent('pt-undo', { bubbles: true, composed: true }));
            return;
        }

        if (this.selection == null) return;

        if (ARROWS[event.key]) {
            event.preventDefault();
            this.#moveSelection(...ARROWS[event.key]);
            return;
        }

        if (!this.interactive || !isEditable(this.doc, this.selection)) return;

        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            this.dispatchEvent(
                new CustomEvent('pt-cell-clear', {
                    detail: { cell: this.selection },
                    bubbles: true,
                    composed: true,
                }),
            );
            return;
        }

        const value = this.valueForKey(event.key);
        if (value == null) return;

        event.preventDefault();
        this.dispatchEvent(
            new CustomEvent('pt-cell-input', {
                // `shiftKey` travels because it is a fact about the keystroke rather than about any
                // one puzzle: crossword reads it as "extend this square into a word", which is the
                // physical-keyboard equivalent of its Rebus switch (ADR-0007). Types that do not
                // care simply ignore it.
                detail: { cell: this.selection, value, shiftKey: event.shiftKey },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * Selects the clicked cell and keeps keyboard focus on the grid.
     *
     * `preventScroll`, because the player has just pointed at the square: they can already see it,
     * and scrolling it to where the browser would rather have it moves the whole grid out from under
     * the finger that is still on it. On a nonogram that was visible as a drag painting one row below
     * the one it started on.
     */
    #onPointerDown(event) {
        const cell = event.target.closest('pt-cell');
        if (!cell) return;
        // A blocked square is never selected. It holds no value, takes no marks, and cannot be
        // checked, so landing the cursor there could only ever be a dead end — and in a crossword,
        // where a third of the grid is black, an easy one to hit. No other type has block cells, so
        // this costs them nothing.
        if (this.doc.cells[cell.index]?.block) return;

        this.renderRoot.querySelector('.grid')?.focus({ preventScroll: true });
        this.#select(cell.index);
    }

    render() {
        if (!this.doc) return nothing;

        const { rows, cols } = this.doc.size;
        return html`
            <div class="layout">
                <div class="gutter-corner"></div>
                <div class="gutter-top" style="--gutter-tracks: ${cols};">
                    ${this.renderTopGutter()}
                </div>
                <div class="gutter-side" style="--gutter-tracks: ${rows};">
                    ${this.renderSideGutter()}
                </div>
                <div class="frame">
                    <div
                        class="grid"
                        role="grid"
                        tabindex="0"
                        aria-label="${this.doc.type} puzzle, ${rows} by ${cols}"
                        style="grid-template-columns: repeat(${cols}, 1fr);"
                        @keydown=${this.#onKeyDown}
                        @pointerdown=${this.#onPointerDown}
                    >
                        ${repeat(
                            Array.from({ length: rows }, (_unused, row) => row),
                            (row) => row,
                            (row) => this.#renderRow(row, cols),
                        )}
                    </div>
                    <pt-presence-layer
                        .focus=${this.focus}
                        .players=${this.players}
                        .rows=${rows}
                        .cols=${cols}
                        .selfId=${this.selfId}
                    ></pt-presence-layer>
                </div>
            </div>
        `;
    }

    /** One ARIA row. `display: contents` keeps the cells in the outer grid's tracks. */
    #renderRow(row, cols) {
        const cells = Array.from({ length: cols }, (_unused, col) => row * cols + col);
        return html`
            <div role="row" style="display: contents;">
                ${repeat(
                    cells,
                    (idx) => idx,
                    (idx) => this.#renderCell(idx),
                )}
            </div>
        `;
    }

    /** One cell, keyed by index so it is created once and updated by property thereafter. */
    #renderCell(idx) {
        const docCell = this.doc.cells[idx];
        const { row, col } = toCoords(idx, this.doc.size);
        const value = effectiveValue(this.doc, this.board, idx);
        const marks = this.board.cells[idx]?.marks ?? [];
        const check = this.checkResults?.[idx] ?? null;

        return html`
            <pt-cell
                role="gridcell"
                .index=${idx}
                .value=${value}
                .label=${docCell.label}
                .marks=${marks}
                .markCols=${this.markColumns}
                .markRows=${this.markRows}
                .glyphs=${this.valueGlyphs}
                .check=${check}
                ?label-row=${this.reservesLabelRow}
                ?given=${docCell.given != null}
                ?block=${docCell.block}
                ?selected=${this.selection === idx}
                ?highlighted=${this.isHighlighted(idx)}
                ?circled=${this.isCircled(idx)}
                ?heavy-right=${this.isHeavyRight(idx)}
                ?heavy-bottom=${this.isHeavyBottom(idx)}
                aria-selected=${this.selection === idx}
                aria-readonly=${docCell.given != null}
                aria-label=${this.#cellLabel(idx, docCell, row, col, value, marks, check)}
            ></pt-cell>
        `;
    }

    /**
     * The cell's spoken description. Everything a sighted player reads off the square is named here
     * rather than left to colour, position, or shape, since none of the three survives a screen
     * reader (design-spec.md §11).
     *
     * A value drawn as a mark is spoken as what the mark means: `#` is a character nobody wants read
     * out, and a screen reader user is owed the same information the shape carries.
     *
     * **The label is part of that**, and used not to be. A kenken cage clue was drawn and never
     * said, so a whole puzzle's constraints were missing for anyone not looking at it — and a
     * crossword's label is its entry number, the only thing tying a square to the clue that solves
     * it. It comes first because it describes the square rather than what is written in it.
     *
     * A blocked square stops after being named. It has no value, can hold no marks, and cannot be
     * checked, so "empty" would invite an edit that is not possible.
     */
    #cellLabel(idx, docCell, row, col, value, marks, check) {
        const spoken = { block: 'filled', cross: 'crossed out' };
        const position = `row ${row + 1} column ${col + 1}`;
        if (docCell.block) return `${position}, blocked`;

        const parts = [position];
        if (docCell.label != null) parts.push(this.spokenLabel(docCell.label, idx));

        if (value != null) parts.push(spoken[this.valueGlyphs?.[value]] ?? value);
        else if (marks.length > 0) parts.push(`notes ${marks.join(' ')}`);
        else parts.push('empty');
        if (check) parts.push(check);

        return parts.join(', ');
    }
}
