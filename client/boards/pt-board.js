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

            .frame {
                position: relative;
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

    /** Tracks the grid's rendered width so cells can size their digits from it. */
    firstUpdated() {
        const grid = this.renderRoot.querySelector('.grid');
        if (!grid || typeof ResizeObserver === 'undefined') return;

        this.#resizeObserver = new ResizeObserver(([entry]) => {
            const cols = this.doc?.size.cols ?? 1;
            grid.style.setProperty('--cell-size', `${entry.contentRect.width / cols}px`);
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

    /** Moves the selection by a row/column delta, stopping at the grid edges. */
    #moveSelection(deltaRow, deltaCol) {
        const size = this.doc.size;
        const current = this.selection ?? 0;
        const { row, col } = toCoords(current, size);
        const nextRow = Math.min(size.rows - 1, Math.max(0, row + deltaRow));
        const nextCol = Math.min(size.cols - 1, Math.max(0, col + deltaCol));
        this.#select(nextRow * size.cols + nextCol);
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
                detail: { cell: this.selection, value },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /** Selects the clicked cell and keeps keyboard focus on the grid. */
    #onPointerDown(event) {
        const cell = event.target.closest('pt-cell');
        if (!cell) return;
        this.renderRoot.querySelector('.grid')?.focus();
        this.#select(cell.index);
    }

    render() {
        if (!this.doc) return nothing;

        const { rows, cols } = this.doc.size;
        return html`
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
                .check=${check}
                ?given=${docCell.given != null}
                ?block=${docCell.block}
                ?selected=${this.selection === idx}
                ?heavy-right=${this.isHeavyRight(idx)}
                ?heavy-bottom=${this.isHeavyBottom(idx)}
                aria-selected=${this.selection === idx}
                aria-readonly=${docCell.given != null}
                aria-label=${this.#cellLabel(row, col, value, marks, check)}
            ></pt-cell>
        `;
    }

    /**
     * The cell's spoken description. Marks and check feedback are named rather than left to colour
     * and position, since neither survives a screen reader (design-spec.md §11).
     */
    #cellLabel(row, col, value, marks, check) {
        const parts = [`row ${row + 1} column ${col + 1}`];
        if (value != null) parts.push(value);
        else if (marks.length > 0) parts.push(`notes ${marks.join(' ')}`);
        else parts.push('empty');
        if (check) parts.push(check);
        return parts.join(', ');
    }
}
