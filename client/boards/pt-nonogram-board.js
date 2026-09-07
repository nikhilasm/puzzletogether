/**
 * The nonogram grid: clue gutters, marks instead of digits, and painting by drag. It needed two
 * general hooks from pt-board (gutters and valueGlyphs) plus one new behaviour, painting: a stroke
 * is collected locally and sent as a single batched fill op when the pointer lifts.
 */

import { css, html } from 'lit';

import { effectiveValue, toCoords } from '../../shared/puzzle-doc.js';

import { PtBoard } from './pt-board.js';

/**
 * Takes or gives up the pointer for a stroke, tolerating engines that disagree about when a capture
 * is held. A convenience rather than the mechanism, since the stroke is tracked from the events
 * themselves, so every failure here is swallowed.
 */
function capture(grid, pointerId, take) {
    try {
        if (take) grid.setPointerCapture?.(pointerId);
        else if (grid.hasPointerCapture?.(pointerId)) grid.releasePointerCapture(pointerId);
    } catch {
        // A capture that cannot be taken or has already lapsed changes nothing about the stroke.
    }
}

export class PtNonogramBoard extends PtBoard {
    static properties = {
        ...PtBoard.properties,
        brush: { type: String },
    };

    static styles = [
        ...PtBoard.styles,
        css`
            /* The board is its own size container so clues size off the host's fixed width via 1cqw,
               rather than off --cell-size, which was circular and reflowed. */
            :host {
                container-type: inline-size;
            }

            /* The counting bands are the hairline colour at three times the weight, not --ink, so
               they do not read as thin filled squares competing with the picture. */
            :host {
                --grid-heavy-color: var(--grid-rule-solid);
                --grid-heavy-width: 3px;
            }

            /* Clues are quiet in --graphite so the grid stays loudest (brand.md §1), sized off a
               track's share of the board width and clamped so a 20×20's clues shrink with its
               squares without going illegible. */
            .clues {
                display: flex;
                gap: 0.4em;
                align-items: center;
                padding: 1px;
                color: var(--graphite);
                font-family: var(--font-ui);
                font-size: clamp(0.5rem, calc((100cqw / var(--gutter-tracks, 10)) * 0.34), 0.85rem);
                font-variant-numeric: tabular-nums;
                line-height: 1;
                white-space: nowrap;
            }

            /* Both stacks end against the grid, so the last clue is the one nearest its line. */
            .gutter-top .clues {
                flex-direction: column;
                justify-content: flex-end;
                padding-bottom: 4px;
            }

            .gutter-side .clues {
                justify-content: flex-end;
                padding-right: 5px;
            }

            /* A line with nothing in it is clued 0, and says so more quietly still. */
            .zero {
                opacity: 0.4;
            }

            /* A nonogram's highlight is the extent of a drag in progress rather than context, so it
               is stronger and deliberately paints over [selected] to stay legible over the run
               while the finger is down. */
            pt-cell[highlighted] {
                background: color-mix(in srgb, var(--focus-color) 48%, transparent);
            }
        `,
    ];

    /** The stroke in progress: which cells it has covered, what it paints, and its locked axis. */
    #stroke = null;

    constructor() {
        super();
        this.brush = 'fill';
    }

    /**
     * The squares this stroke has covered so far, washed while the finger is still down. A drag
     * commits on release, so showing the extent as it grows is what makes a run countable against
     * its clue before it is too late to adjust.
     */
    isHighlighted(idx) {
        return this.#stroke?.cells.has(idx) ?? false;
    }

    /**
     * The finished picture is left alone; the wave runs through the ground around it. A nonogram's
     * filled squares are the answer drawn in --ink, so washing colours across them would paint over
     * what was just completed.
     */
    celebrates(idx) {
        if (!super.celebrates(idx)) return false;
        return effectiveValue(this.doc, this.board, idx) !== this.doc.meta.values.fill;
    }

    /** A filled cell is a solid block; a crossed one is the player's note that nothing goes there. */
    get valueGlyphs() {
        const values = this.doc?.meta.values;
        return values ? { [values.fill]: 'block', [values.cross]: 'cross' } : null;
    }

    /**
     * A heavier rule every fifth column: the same hook sudoku uses for its regions. These divide
     * nothing and are there to be counted against, which is what makes matching a clue to a run
     * immediate on a banded grid.
     */
    isHeavyRight(idx) {
        const col = idx % this.doc.size.cols;
        return (col + 1) % 5 === 0 && col + 1 < this.doc.size.cols;
    }

    /** As isHeavyRight, every fifth row. */
    isHeavyBottom(idx) {
        const row = Math.floor(idx / this.doc.size.cols);
        return (row + 1) % 5 === 0 && row + 1 < this.doc.size.rows;
    }

    /**
     * Starts listening for strokes once the grid exists. A stroke begins on the grid but can end
     * anywhere, so the release is watched on the window, or letting go outside it would discard the
     * stroke.
     */
    firstUpdated() {
        super.firstUpdated();

        const grid = this.renderRoot.querySelector('.grid');
        if (!grid) return;
        grid.addEventListener('pointerdown', this.#onStrokeStart);
        grid.addEventListener('pointermove', this.#onStrokeMove);
        window.addEventListener('pointerup', this.#onStrokeEnd);
        window.addEventListener('pointercancel', this.#onStrokeEnd);
    }

    /** Drops the window listeners with the element, so a removed board cannot keep painting. */
    disconnectedCallback() {
        window.removeEventListener('pointerup', this.#onStrokeEnd);
        window.removeEventListener('pointercancel', this.#onStrokeEnd);
        super.disconnectedCallback();
    }

    /** The column clues, one stack per column, reading downward into the grid. */
    renderTopGutter() {
        return this.doc.meta.colClues.map((clues, col) =>
            this.#renderClues(clues, `column ${col + 1}`),
        );
    }

    /** The row clues, one line per row, reading rightward into the grid. */
    renderSideGutter() {
        return this.doc.meta.rowClues.map((clues, row) =>
            this.#renderClues(clues, `row ${row + 1}`),
        );
    }

    /**
     * Keyboard input: the two marks, on the keys that mean them. Space fills and x crosses;
     * Backspace and Delete already empty a cell via pt-board.
     */
    valueForKey(key) {
        const { fill, cross } = this.doc.meta.values;
        if (key === ' ' || key === 'Enter') return fill;
        if (key.toLowerCase() === cross) return cross;
        return null;
    }

    /** One line's clues, named for a screen reader: a gutter cannot be read by position. */
    #renderClues(clues, line) {
        const isEmptyLine = clues.length === 1 && clues[0] === 0;
        return html`
            <div class="clues" aria-label="${line}: ${isEmptyLine ? 'empty' : clues.join(' ')}">
                ${clues.map((clue) => html`<span class=${isEmptyLine ? 'zero' : ''}>${clue}</span>`)}
            </div>
        `;
    }

    /**
     * The cell a pointer event belongs to. A press uses the event's own target, while a drag falls
     * back to hit-testing coordinates, since a captured pointer reports the grid as its target.
     */
    #cellAt(event) {
        const target = event.target?.closest?.('pt-cell');
        if (target) return target;

        const element = this.renderRoot.elementFromPoint?.(event.clientX, event.clientY);
        return element?.closest?.('pt-cell') ?? null;
    }

    /**
     * Opens a stroke, deciding from the first cell what the whole of it will write. Starting on a
     * cell that already holds the brush value makes the stroke erase, so one gesture both paints a
     * run and takes it back; re-deciding per cell would leave a checkerboard.
     */
    #onStrokeStart = (event) => {
        if (!this.interactive || (event.button != null && event.button !== 0)) return;

        const cell = this.#cellAt(event);
        if (!cell) return;

        const { fill, cross } = this.doc.meta.values;
        const brushValue = this.brush === 'cross' ? cross : this.brush === 'erase' ? null : fill;
        const current =
            this.board.cells[cell.index]?.value ?? this.doc.cells[cell.index]?.given ?? null;

        this.#stroke = {
            value: brushValue !== null && current === brushValue ? null : brushValue,
            cells: new Set([cell.index]),
            origin: toCoords(cell.index, this.doc.size),
            axis: null,
        };

        capture(event.currentTarget, event.pointerId, true);
        this.requestUpdate();
    };

    /**
     * Extends the stroke, locked to the row or column it started along, since an unlocked drag on a
     * phone paints a wobbly diagonal. The axis is fixed by the first cell reached outside the
     * origin, and cells off that line are ignored.
     */
    #onStrokeMove = (event) => {
        if (!this.#stroke) return;

        const cell = this.#cellAt(event);
        if (!cell || this.#stroke.cells.has(cell.index)) return;

        const { row, col } = toCoords(cell.index, this.doc.size);
        const { origin } = this.#stroke;

        if (this.#stroke.axis === null) {
            if (row === origin.row && col === origin.col) return;
            this.#stroke.axis = row === origin.row ? 'row' : col === origin.col ? 'col' : null;
            if (this.#stroke.axis === null) return;
        }

        const onAxis = this.#stroke.axis === 'row' ? row === origin.row : col === origin.col;
        if (!onAxis) return;

        // Only when the run actually grows: a pointer crossing a square it has already covered
        // arrives many times a second and must not re-render the grid for each of them.
        this.#stroke.cells.add(cell.index);
        this.requestUpdate();
    };

    /**
     * Closes the stroke and sends it as one op. Dispatched before the capture is released, since
     * releasePointerCapture can throw on a pointer it no longer holds and losing the stroke to that
     * would be the worst trade.
     */
    #onStrokeEnd = (event) => {
        const stroke = this.#stroke;
        this.#stroke = null;
        if (!stroke) return;

        // Drops the wash. The op that replaces it is applied optimistically, so the marks land in
        // the same frame and the run never flickers back to bare squares in between.
        this.requestUpdate();
        this.dispatchEvent(
            new CustomEvent('pt-cells-paint', {
                detail: { cells: [...stroke.cells], value: stroke.value },
                bubbles: true,
                composed: true,
            }),
        );

        capture(this.renderRoot.querySelector('.grid'), event.pointerId, false);
    };
}

customElements.define('pt-nonogram-board', PtNonogramBoard);
