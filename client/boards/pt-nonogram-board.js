/**
 * The nonogram grid: clue gutters, marks instead of digits, and painting by drag.
 *
 * This is the type that asked most of `<pt-board>`, and what it needed was two hooks rather than an
 * exception: somewhere to draw alongside the grid (`renderTopGutter` / `renderSideGutter`), and a say
 * in how a cell value is drawn (`valueGlyphs`). Both are general — a puzzle either draws a gutter or
 * it does not — and every other type is unaffected by their existence.
 *
 * Painting is the one behaviour genuinely new here. A nonogram is solved by dragging across runs of
 * cells, so a stroke is collected locally and sent as a **single batched `fill` op** when the pointer
 * lifts: twenty painted cells are one write, one echo, and one undo step rather than twenty of each.
 */

import { css, html } from 'lit';

import { effectiveValue, toCoords } from '../../shared/puzzle-doc.js';

import { PtBoard } from './pt-board.js';

/**
 * Takes or gives up the pointer for the duration of a stroke, tolerating engines that disagree about
 * when a capture is still held.
 *
 * Capture is what keeps a drag attached to the grid when the finger wanders off it. It is a
 * convenience, not the mechanism — the stroke is tracked from the events themselves — so every
 * failure here is swallowed rather than allowed to interrupt painting.
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
            /*
             * The board is its own size container, which is what lets the clues size themselves off
             * something that cannot move underneath them.
             *
             * Sizing them from --cell-size looked right and was circular: the cell size comes from
             * the grid's width, the grid's width is what is left after the side gutter, and the
             * gutter is as wide as its clues. The board reflowed two or three times settling that
             * loop, and a tap landing during the settle painted the wrong square. The host's width
             * is fixed by the page, so 1cqw closes the loop.
             */
            :host {
                container-type: inline-size;
            }

            /*
             * The counting bands are the grid's own line, thicker — not the ink the picture is drawn
             * in.
             *
             * Sudoku's heavy rules are --ink because they divide the puzzle into regions that carry a
             * rule. A nonogram's bands divide nothing; they exist to be counted against. Drawn in
             * --ink they read as filled squares that happen to be thin, competing with the picture
             * they are supposed to help measure. Same colour as the hairlines, three times the
             * weight: unmistakably a major division, unmistakably not a mark.
             */
            :host {
                --grid-heavy-color: var(--grid-rule-solid);
                --grid-heavy-width: 3px;
            }

            /*
             * Clues are quiet. They state the puzzle rather than being part of the picture, so they
             * sit in --graphite and step down in size while the grid keeps its weight — the grid is
             * still the loudest thing on the screen (brand.md §1).
             *
             * A track's share of the board's width stands in for the cell size, so a 20×20's clues
             * shrink with its squares instead of pushing the grid off a phone. The clamp stops that
             * going illegible at one end or overbearing at the other.
             */
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

            /*
             * A nonogram's highlight is the only one that is not context.
             *
             * Everywhere else the wash says "this is what your cursor implies" and is a faint tint
             * under the cursor's own strength. Here it is the extent of a drag *in progress*, which
             * has to be legible over the marks already in the run and has to be readable while the
             * finger is still down — including on the square the cursor happens to be sitting on,
             * which is why this deliberately paints over [selected] rather than ducking under it.
             */
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
     * The squares this stroke has covered so far, washed while the finger is still down.
     *
     * A drag is committed on release, so without this the grid says nothing at all until the gesture
     * is over — and the whole reason to drag rather than tap is to lay down a run of a particular
     * length against a clue. Showing the extent as it grows is what makes that countable before it is
     * too late to adjust.
     */
    isHighlighted(idx) {
        return this.#stroke?.cells.has(idx) ?? false;
    }

    /**
     * The finished picture is left alone; the wave runs through the ground around it.
     *
     * Every other type celebrates the squares that were filled in, because those are what the room
     * worked out. A nonogram inverts that — the filled squares *are* the answer, a picture drawn in
     * --ink — and washing the room's colours across it would be painting over the thing that was
     * just completed. What is left is the shape of the picture in negative, which is the same wave
     * saying the same thing about the same puzzle.
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
     * A heavier rule every fifth column — the same hook sudoku uses for its regions.
     *
     * These divide nothing: a nonogram has no regions, and the guides carry no rule about what may go
     * where. They are there to be **counted against**, which is the whole of solving a nonogram —
     * matching a clue of 7 to a run of squares is guesswork on an unmarked 20×20 grid and immediate
     * on a grid banded in fives.
     */
    isHeavyRight(idx) {
        const col = idx % this.doc.size.cols;
        return (col + 1) % 5 === 0 && col + 1 < this.doc.size.cols;
    }

    /** As `isHeavyRight`, every fifth row. */
    isHeavyBottom(idx) {
        const row = Math.floor(idx / this.doc.size.cols);
        return (row + 1) % 5 === 0 && row + 1 < this.doc.size.rows;
    }

    /**
     * Starts listening for strokes once the grid exists.
     *
     * A stroke *begins* on the grid but has to be able to *end* anywhere, so the release is watched
     * on the window. Letting go outside the window — or past the bottom of it, which is easy to do
     * on a tall grid — otherwise leaves the stroke open and silently discards everything the player
     * just painted.
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
     * Keyboard input: the two marks, on the keys that mean them.
     *
     * Space fills because it is the key already under a hand on the grid, and `x` crosses because
     * that is the character the cell shows. Backspace and Delete already empty a cell via
     * `<pt-board>`, so there is no third key to find.
     */
    valueForKey(key) {
        const { fill, cross } = this.doc.meta.values;
        if (key === ' ' || key === 'Enter') return fill;
        if (key.toLowerCase() === cross) return cross;
        return null;
    }

    /** One line's clues, named for a screen reader — a gutter cannot be read by position. */
    #renderClues(clues, line) {
        const isEmptyLine = clues.length === 1 && clues[0] === 0;
        return html`
            <div class="clues" aria-label="${line}: ${isEmptyLine ? 'empty' : clues.join(' ')}">
                ${clues.map((clue) => html`<span class=${isEmptyLine ? 'zero' : ''}>${clue}</span>`)}
            </div>
        `;
    }

    /**
     * The cell a pointer event belongs to.
     *
     * The event's own target is authoritative and free, and it is what a press gives us. A drag
     * cannot use it — once the grid captures the pointer, every move reports the grid as its target —
     * so those fall back to hit-testing the coordinates, which is only sound because nothing moves
     * under a captured pointer.
     */
    #cellAt(event) {
        const target = event.target?.closest?.('pt-cell');
        if (target) return target;

        const element = this.renderRoot.elementFromPoint?.(event.clientX, event.clientY);
        return element?.closest?.('pt-cell') ?? null;
    }

    /**
     * Opens a stroke, and decides there and then what the whole of it will write.
     *
     * Deciding once, from the first cell, is what makes dragging predictable: starting on a cell that
     * already holds what the brush paints means the stroke *erases*, so one gesture covers both
     * painting a run and taking it back, and a mis-tap is undone by tapping again. A stroke that
     * re-decided per cell would leave a checkerboard behind instead.
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
     * Extends the stroke, locked to the row or column it started along.
     *
     * Nonogram runs are straight, and an unlocked drag on a phone paints a wobbly diagonal smear of
     * whatever the thumb passed over. The axis is fixed by the first cell the stroke reaches outside
     * its origin, and cells off that line are ignored rather than ending the stroke.
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

        // Only when the run actually grows — a pointer crossing a square it has already covered
        // arrives many times a second and must not re-render the grid for each of them.
        this.#stroke.cells.add(cell.index);
        this.requestUpdate();
    };

    /**
     * Closes the stroke and sends it as one op.
     *
     * The stroke is dispatched *before* the capture is released, because releasing can throw — the
     * capture lapses on its own in some engines, and `releasePointerCapture` treats a pointer it no
     * longer holds as an error. Losing what the player just painted to a bookkeeping call on the way
     * out would be the worst possible trade.
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
