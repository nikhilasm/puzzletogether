/**
 * The crossword grid: black squares, entry numbers, and a cursor that has a *direction* as well as
 * a position.
 *
 * Direction is the whole of what makes this board different. Every other type has a cursor that is
 * simply somewhere; a crossword's is somewhere **and pointing**, and almost every navigation rule
 * below exists to keep that second half correct without the player ever having to think about it.
 *
 * Direction is local to each player, not shared. Two people can work the same square from different
 * directions, and where everyone else is stays on the grid as presence dots (design-spec.md §4).
 */

import { css } from 'lit';

import { effectiveValue, toCoords } from '../../shared/puzzle-doc.js';

import {
    ACROSS,
    DOWN,
    entryAt,
    firstOpenCell,
    hasDirection,
    indexEntries,
    nextInEntry,
    prevInEntry,
    stepEntry,
} from './crossword-entries.js';
import { PtBoard } from './pt-board.js';

export class PtCrosswordBoard extends PtBoard {
    static properties = {
        ...PtBoard.properties,
        /** Which way the cursor points. Local to this player. */
        direction: { type: String },
    };

    static styles = [
        ...PtBoard.styles,
        css`
            /*
             * The square the cursor is on, against the rest of its entry.
             *
             * Two depths of the same accent rather than two colours: the entry is context and the
             * cursor is position, and they are the same idea at different strengths. The base
             * element already washes the selected cell; this deepens it, so the cursor stays findable
             * inside a highlighted run of fifteen squares.
             */
            pt-cell[selected] {
                background: color-mix(in srgb, var(--accent) 34%, transparent);
            }
        `,
    ];

    /** Cell-to-entry lookup, rebuilt only when the document changes. */
    #index = null;

    /** The document the current index was built from, so a new puzzle rebuilds it and nothing else. */
    #indexedDoc = null;

    constructor() {
        super();
        this.direction = ACROSS;
    }

    /**
     * The entry index for the current document, built at most once per puzzle.
     *
     * @returns {object} The index from `indexEntries`.
     */
    get index() {
        if (this.#indexedDoc !== this.doc) {
            this.#index = indexEntries(this.doc);
            this.#indexedDoc = this.doc;
        }
        return this.#index;
    }

    /**
     * The entry the cursor is currently working, which is what the clue bar shows.
     *
     * @returns {object|null} The entry, or null before anything is selected.
     */
    get currentEntry() {
        if (this.selection == null) return null;
        return entryAt(this.index, this.selection, this.direction);
    }

    /** A crossword has no regions, so nothing draws a heavy rule inside the frame. */
    isHeavyRight() {
        return false;
    }

    isHeavyBottom() {
        return false;
    }

    /** Circled squares travel in the document, since only the puzzle knows which they are. */
    isCircled(idx) {
        return this.doc?.meta?.circled?.includes(idx) ?? false;
    }

    /** Every square in the entry under the cursor, which is the context the solver is reading. */
    isHighlighted(idx) {
        const entry = this.currentEntry;
        return entry != null && entry.cells.includes(idx);
    }

    /**
     * Letters only, and always uppercase.
     *
     * A crossword's answers are stored uppercase, so lowercasing anywhere would make `a` and `A`
     * different answers to the same clue — a grid nobody could complete. Filtering here rather than
     * at the store keeps every source of input on the same rule.
     *
     * @param {string} key - The `KeyboardEvent.key` value.
     * @returns {string|null} The letter to write, or null when the key means nothing here.
     */
    valueForKey(key) {
        if (key.length !== 1) return null;
        const letter = key.toUpperCase();
        return (this.doc?.meta?.alphabet ?? '').includes(letter) ? letter : null;
    }

    /**
     * A crossword number says what *starts* here, which the bare number cannot.
     *
     * "1" alone tells a screen reader user nothing about which clue solves the square they are on,
     * and the direction is a property of their cursor rather than of the cell — so the honest thing
     * for a square to say is which entries begin in it.
     *
     * @param {string} label - The number as drawn.
     * @param {number} idx - The square it is drawn in.
     * @returns {string} What a screen reader should say in its place.
     */
    spokenLabel(label, idx) {
        const starts = this.index.entries.filter(
            (entry) => entry.cells[0] === idx && String(entry.num) === label,
        );
        if (starts.length === 0) return label;
        const names = starts.map((entry) => (entry.dir === ACROSS ? 'across' : 'down'));
        return `starts ${label} ${names.join(' and ')}`;
    }

    /**
     * Arrow keys, which in a crossword mean two different things depending on which way they point.
     *
     * Along the direction you are working, an arrow moves the cursor. **Across it, the arrow turns
     * the cursor** and leaves it where it is — the rule every crossword solver relies on without
     * being able to state, and the reason a first press of Down on an Across clue should not jump a
     * row. Only when already pointing that way does it move.
     *
     * Black squares are skipped rather than stopped at: the cursor keeps travelling in the same
     * direction until it finds an open square or runs out of grid.
     *
     * @param {number} from - Cell the selection is leaving.
     * @param {number} deltaRow - -1, 0, or 1.
     * @param {number} deltaCol - -1, 0, or 1.
     * @returns {number|null} The cell to select, or null to stay where it is.
     */
    nextSelection(from, deltaRow, deltaCol) {
        const wanted = deltaRow !== 0 ? DOWN : ACROSS;
        if (wanted !== this.direction && hasDirection(this.index, from, wanted)) {
            this.direction = wanted;
            return from;
        }

        const size = this.doc.size;
        let { row, col } = toCoords(from, size);
        for (;;) {
            row += deltaRow;
            col += deltaCol;
            if (row < 0 || col < 0 || row >= size.rows || col >= size.cols) return null;
            const idx = row * size.cols + col;
            if (!this.doc.cells[idx].block) return idx;
        }
    }

    /**
     * After a letter lands, move along the entry — and stop at its end rather than running on.
     *
     * @param {number} idx - The square just filled.
     * @returns {number|null} The next square in the entry, or null at its end.
     */
    advanceAfterInput(idx) {
        return nextInEntry(this.index, idx, this.direction);
    }

    /**
     * Turns the cursor around, which is what tapping the selected square or the clue bar does.
     *
     * Refuses when there is no entry the other way — an unchecked square has only one — because
     * turning to point at nothing would leave the clue bar showing a clue that does not run through
     * the square the cursor is on.
     *
     * @returns {void}
     */
    toggleDirection() {
        if (this.selection == null) return;
        const other = this.direction === ACROSS ? DOWN : ACROSS;
        if (!hasDirection(this.index, this.selection, other)) return;
        this.direction = other;
    }

    /**
     * Moves to another entry, as Tab does, landing on its first square still empty.
     *
     * @param {number} step - `1` for the next entry, `-1` for the previous.
     * @returns {void}
     */
    moveToEntry(step) {
        const entry = stepEntry(this.index, this.currentEntry, step);
        if (!entry) return;
        this.direction = entry.dir;
        this.goTo(firstOpenCell(entry, (cell) => effectiveValue(this.doc, this.board, cell)));
    }

    /**
     * Puts the cursor on a square and tells the screen around it, which is how the clue list and the
     * clue bar move a player without reaching into this element's state.
     *
     * @param {number} cell - Flat cell index.
     * @param {'A'|'D'} [dir] - Direction to face, if the caller cares.
     * @returns {void}
     */
    goTo(cell, dir = null) {
        if (dir) this.direction = dir;
        this.dispatchEvent(
            new CustomEvent('pt-cell-select', { detail: { cell }, bubbles: true, composed: true }),
        );
    }

    /**
     * Tells the screen which entry is now current, so the clue bar can follow the cursor.
     *
     * Announced from `updated` and nowhere else. Selection is owned by the store, so it arrives back
     * here as a property one render later — announcing at the moment of asking would report the
     * entry the cursor was leaving.
     */
    #announceEntry() {
        this.dispatchEvent(
            new CustomEvent('pt-entry-change', {
                detail: { entry: this.currentEntry, direction: this.direction },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * The keys a crossword adds on top of what every board handles.
     *
     * Tab and Enter both move to the next entry, because both are what people press: Tab is the
     * convention on desktop and Enter is what a solver coming from paper reaches for. Space turns the
     * cursor, which is the other near-universal binding.
     *
     * Backspace has a rule of its own worth stating. On an empty square it steps *back* and clears
     * the square it lands on, so holding it walks a wrong answer out of the grid — deleting nothing,
     * repeatedly, is not what anybody means by pressing it twice.
     */
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('keydown', this.#onCrosswordKey, { capture: true });
        this.addEventListener('pointerdown', this.#onCrosswordPointer, { capture: true });
    }

    disconnectedCallback() {
        this.removeEventListener('keydown', this.#onCrosswordKey, { capture: true });
        this.removeEventListener('pointerdown', this.#onCrosswordPointer, { capture: true });
        super.disconnectedCallback();
    }

    /**
     * Tapping the square the cursor is already on turns it around.
     *
     * Caught on the way down, while `this.selection` is still the square being tapped — the base
     * element's own handler asks the store to move the cursor, and the answer does not come back
     * until the next render, so afterwards there would be no way to tell a re-tap from a first tap.
     */
    #onCrosswordPointer = (event) => {
        if (!this.doc || !this.interactive) return;
        const cell = event.composedPath().find((node) => node.localName === 'pt-cell');
        if (cell && cell.index === this.selection) this.toggleDirection();
    };

    /** Handles the crossword-only keys, letting everything else fall through to the base. */
    #onCrosswordKey = (event) => {
        if (!this.doc || !this.interactive) return;

        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            this.moveToEntry(event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            this.moveToEntry(1);
            return;
        }
        if (event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            this.toggleDirection();
            return;
        }
        if (event.key === 'Backspace' && this.selection != null) {
            const empty = effectiveValue(this.doc, this.board, this.selection) == null;
            if (!empty) return;
            const back = prevInEntry(this.index, this.selection, this.direction);
            if (back == null) return;
            event.preventDefault();
            event.stopPropagation();
            this.goTo(back);
            this.dispatchEvent(
                new CustomEvent('pt-cell-clear', {
                    detail: { cell: back },
                    bubbles: true,
                    composed: true,
                }),
            );
        }
    };

    /** Whenever the cursor's position or heading settles, the clue bar is told what it is now on. */
    updated(changed) {
        super.updated?.(changed);
        if (changed.has('selection') || changed.has('direction') || changed.has('doc')) {
            this.#announceEntry();
        }
    }
}

customElements.define('pt-crossword-board', PtCrosswordBoard);
