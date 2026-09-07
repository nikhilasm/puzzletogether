/**
 * Base element for every puzzle grid: geometry, cell DOM, selection, the presence layer, and input.
 * Subclasses supply only cell decoration and input filtering; a new type should be one server
 * module plus one subclass of this (design-spec.md §7).
 */

import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { INPUT_MODE } from '../../shared/protocol.js';
import { effectiveValue, isEditable, toCoords } from '../../shared/puzzle-doc.js';
import { focusRing } from '../styles/controls.js';

import './pt-cell.js';
import './pt-celebration-layer.js';
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
        /** The store's input mode, so the N shortcut can flip it: solve or notes. */
        inputMode: { type: String },
        /** Whether this type has a Notes setting, which is what gates the N shortcut. */
        hasNotes: { type: Boolean },
        checkResults: { type: Object },
        /** Whether the room has just solved this puzzle and the grid is saying so. */
        celebrating: { type: Boolean },
    };

    static styles = [
        focusRing,
        css`
            :host {
                display: block;
                width: 100%;
            }

            /* Both gutter tracks are min-content, so a type that draws nothing in them (every type
               but nonogram) collapses them to nothing. */
            .layout {
                display: grid;
                grid-template-columns: min-content 1fr;
                grid-template-rows: min-content 1fr;
            }

            /* Both gutters reproduce the grid's inset exactly, since a clue column half a cell off
               its grid column makes a nonogram unreadable. */
            .gutter-top,
            .gutter-side {
                display: grid;
            }

            /* minmax(0, 1fr) rather than 1fr, so a clue too wide shrinks or clips instead of
               pushing its column wider than the square beneath it. */
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

            /* Opaque so the page's graph-paper texture cannot show through as a second unaligned
               grid; on the frame rather than each cell so the washes composite over one flat
               backdrop. */
            .frame {
                position: relative;
                background: var(--paper);
                border: var(--grid-heavy);
                border-radius: var(--radius-grid);
            }

            /* Columns are declared inline as minmax(0, 1fr), never a bare 1fr, whose min-content
               minimum lets a wide rebus square grow its column and throw every row out of
               alignment. */
            .grid {
                display: grid;
                touch-action: manipulation;
                /* The grid's hairlines and the frame's heavy border would double up on the last row
                   and column, so cells drop their trailing edge. */
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
        this.inputMode = INPUT_MODE.SOLVE;
        this.hasNotes = false;
        this.checkResults = {};
        this.celebrating = false;
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
     * contest: the clue is drawn in the top-left corner, and so is the note "1".
     *
     * @returns {boolean} True to reserve a row for the label.
     */
    get reservesLabelRow() {
        return false;
    }

    /**
     * Tracks the grid's rendered width so everything in the board can size itself from it.
     * Published on the host rather than the grid, because the gutters are not inside the grid and
     * need it too.
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

    /**
     * Publishes the local player's colour as --focus-color, which draws this player's cursor in
     * their own colour rather than the app's accent. Written to the host so the cells a shadow root
     * down inherit it, and guarded since the roster changes without moving this player's colour.
     */
    willUpdate(changed) {
        if (!changed.has('players') && !changed.has('selfId')) return;
        const self = this.players?.find((player) => player.id === this.selfId);
        if (self) this.style.setProperty('--focus-color', `var(--player-${self.colorIndex})`);
        else this.style.removeProperty('--focus-color');
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
     * @param {string} _key - The KeyboardEvent.key value.
     * @returns {string|null} The value to write, or null when the key means nothing here.
     */
    valueForKey(_key) {
        return null;
    }

    /**
     * How each cell value is drawn, for puzzles whose cells hold marks rather than characters.
     *
     * @returns {Object<string, string>|null} Value to 'block' or 'cross', or null to draw every
     *   value as the character it is.
     */
    get valueGlyphs() {
        return null;
    }

    /**
     * How a cell's label should be said, when that differs from how it is drawn: a corner label is
     * not written to be read aloud. The base returns it untouched, and only the subclass, which
     * knows what the label means, composes the spoken phrase.
     *
     * @param {string} label - The label as drawn in the cell.
     * @param {number} _idx - The cell the label is drawn in, for types whose label describes the
     *   square's place in the puzzle rather than its contents: a crossword number means "entries
     *   start here", which the label alone cannot say. KenKen ignores it.
     * @returns {string} What a screen reader should say in its place.
     */
    spokenLabel(label, _idx) {
        return label;
    }

    /**
     * Whether the square is annotated rather than special: a ring drawn on it, carrying no rule.
     * Crossword's circled squares are the case, usually hiding a bonus answer, but they behave like
     * every other square.
     *
     * @param {number} _idx - Cell index.
     * @returns {boolean} True to draw the ring.
     */
    isCircled(_idx) {
        return false;
    }

    /**
     * Where an arrow key lands, given where it started and which way it pointed; the default is the
     * adjacent square, stopping at the edges. A subclass may skip squares, turn, or change its own
     * state here, which is how crossword's direction flip happens.
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
     * Where the cursor goes once a value has been written into a square, or nowhere. Nowhere suits a
     * grid filled in no particular order like sudoku; a crossword is read along an entry, so it
     * advances.
     *
     * @param {number} _idx - The cell just written to.
     * @returns {number|null} The next cell, or null to leave the selection alone.
     */
    advanceAfterInput(_idx) {
        return null;
    }

    /**
     * Whether a square takes part in the wave of colour that runs across a finished grid. Blocked
     * squares do not, so the wave traces the puzzle's shape rather than a rectangle; only crossword
     * has them.
     *
     * @param {number} idx - Cell index.
     * @returns {boolean} True to pulse this square.
     */
    celebrates(idx) {
        return !this.doc.cells[idx].block;
    }

    /**
     * Whether a cell is part of what the player is reaching for, the extent around the single
     * selected cell: by default the cursor's row and column, which is what a Latin-square solver
     * scans. A type overrides for a different meaning, or to false for none.
     *
     * @param {number} idx - Cell index.
     * @returns {boolean} True to wash the cell as context for the cursor.
     */
    isHighlighted(idx) {
        if (this.selection == null) return false;
        const cols = this.doc.size.cols;
        return (
            Math.floor(idx / cols) === Math.floor(this.selection / cols) ||
            idx % cols === this.selection % cols
        );
    }

    /**
     * What this puzzle draws above its grid, aligned to the columns: nonogram's column clues.
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

        // N flips Notes, the same store value the on-screen toggle owns. Gated to types that have
        // the setting so a letter puzzle still types N, and needs no selection, since it is a mode
        // rather than a move.
        if (this.hasNotes && this.interactive && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            const next = this.inputMode === INPUT_MODE.NOTES ? INPUT_MODE.SOLVE : INPUT_MODE.NOTES;
            this.dispatchEvent(
                new CustomEvent('pt-mode-change', {
                    detail: { mode: next },
                    bubbles: true,
                    composed: true,
                }),
            );
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
                // shiftKey travels because it is a fact about the keystroke rather than about any
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
     * Selects the clicked cell and keeps keyboard focus on the grid. preventScroll, because
     * scrolling the just-pointed-at square into view moves the grid out from under a finger
     * mid-drag.
     */
    #onPointerDown(event) {
        const cell = event.target.closest('pt-cell');
        if (!cell) return;
        // A blocked square is never selected: it holds no value, takes no marks, and cannot be
        // checked, so the cursor there is a dead end. Only crossword has block cells, so this costs
        // the rest nothing.
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
                        style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));"
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
                    ${this.celebrating ? this.#renderCelebration(rows, cols) : nothing}
                </div>
            </div>
        `;
    }

    /**
     * The wave of colour across a finished grid; which squares take part is decided here rather
     * than in the layer, since that is a fact about the puzzle. Hidden from a screen reader, which
     * the congrats modal already covers, and rendered only while celebrating so its arrival starts
     * the animation.
     */
    #renderCelebration(rows, cols) {
        const cells = [];
        for (let idx = 0; idx < rows * cols; idx += 1) {
            if (this.celebrates(idx)) cells.push(idx);
        }

        return html`
            <pt-celebration-layer
                aria-hidden="true"
                .cells=${cells}
                .players=${this.players}
                .rows=${rows}
                .cols=${cols}
            ></pt-celebration-layer>
        `;
    }

    /** One ARIA row. display: contents keeps the cells in the outer grid's tracks. */
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

    /**
     * One cell, keyed by index so it is created once and updated by property thereafter. The
     * cursor's washes stand down while the wave runs, withheld here on the selected and highlighted
     * attributes rather than in CSS since the board types paint the wash differently; aria-selected
     * is untouched.
     */
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
                .clue=${docCell.clue ?? null}
                .marks=${marks}
                .markCols=${this.markColumns}
                .markRows=${this.markRows}
                .glyphs=${this.valueGlyphs}
                .check=${check}
                ?label-row=${this.reservesLabelRow}
                ?given=${docCell.given != null}
                ?block=${docCell.block}
                ?selected=${!this.celebrating && this.selection === idx}
                ?highlighted=${!this.celebrating && this.isHighlighted(idx)}
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
     * The cell's spoken description; everything a sighted player reads off the square is named here,
     * since colour, position, and shape do not survive a screen reader (design-spec.md §11). A value
     * drawn as a mark is spoken as what it means, the label comes first, and a blocked square stops
     * after being named unless it carries a kakuro clue.
     */
    #cellLabel(idx, docCell, row, col, value, marks, check) {
        const spoken = { block: 'filled', cross: 'crossed out' };
        const position = `row ${row + 1} column ${col + 1}`;
        if (docCell.block) {
            const clue = docCell.clue;
            if (!clue) return `${position}, blocked`;
            const sums = [];
            if (clue.down != null) sums.push(`${clue.down} down`);
            if (clue.across != null) sums.push(`${clue.across} across`);
            return `${position}, clue ${sums.join(', ')}`;
        }

        const parts = [position];
        if (docCell.label != null) parts.push(this.spokenLabel(docCell.label, idx));

        if (value != null) parts.push(spoken[this.valueGlyphs?.[value]] ?? value);
        else if (marks.length > 0) parts.push(`notes ${marks.join(' ')}`);
        else parts.push('empty');
        if (check) parts.push(check);

        return parts.join(', ');
    }
}
