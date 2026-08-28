/**
 * The crossword grid: black squares, entry numbers, and a cursor that has a *direction* as well as
 * a position.
 *
 * Direction is the whole of what makes this board different. Every other type has a cursor that is
 * simply somewhere; a crossword's is somewhere **and pointing**, and almost every navigation rule
 * below exists to keep that second half correct without the player ever having to think about it.
 *
 * Direction is local to each player, not shared. Two people can work the same square from different
 * directions, and where everyone else is stays on the grid as presence stripes (design-spec.md §4).
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
    nextOpenInEntry,
    prevInEntry,
    stepEntry,
    stepEntryInDirection,
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
             * cursor is position, and they are the same idea at different strengths.
             *
             * The *gap* between the two depths is the point. Four percentage points apart, a solver
             * glancing back at a fifteen-square run cannot find their own cursor, which was the
             * single most-reported thing after the first playtest. So the cursor is a solid
             * statement of position and the entry is barely more than a tint: the question the
             * entry wash answers is "which word am I in", and it only has to be distinguishable
             * from *no wash at all* to answer it.
             *
             * Both depths are the player's own colour, via --focus-color: the base element's
             * rule in the player's hue, at the strengths a crossword needs. A crossword's cursor
             * carries more than any other type's (it also has a *direction*), and its squares are
             * the smallest thing a room ever shares, so it keeps its own numbers rather than
             * inheriting ones tuned for a 9×9.
             */
            pt-cell[selected] {
                background: color-mix(in srgb, var(--focus-color) 62%, transparent);
            }

            pt-cell[highlighted]:not([selected]) {
                background: color-mix(in srgb, var(--focus-color) 13%, transparent);
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
     * @returns {object} The index from indexEntries.
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
     * A crossword's answers are stored uppercase, so lowercasing anywhere would make a and A
     * different answers to the same clue: a grid nobody could complete. Filtering here rather than
     * at the store keeps every source of input on the same rule.
     *
     * @param {string} key - The KeyboardEvent.key value.
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
     * and the direction is a property of their cursor rather than of the cell, so the honest thing
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
     * the cursor** and leaves it where it is: the rule every crossword solver relies on without
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
     * After a letter lands, move along the entry, **over anything already filled in**, and stop at
     * its end rather than running on.
     *
     * The board's own view of the grid is one op behind here: the letter that triggered this has been
     * sent but has not come back as a property yet. That costs nothing, because the only square it
     * changed is the one being left, and the search starts after it.
     *
     * @param {number} idx - The square just filled.
     * @returns {number|null} The next square to type into, or null at the entry's end.
     */
    advanceAfterInput(idx) {
        return nextOpenInEntry(this.index, idx, this.direction, (cell) =>
            effectiveValue(this.doc, this.board, cell),
        );
    }

    /**
     * Turns the cursor around, which is what tapping the selected square or the clue bar does.
     *
     * Refuses when there is no entry the other way, as an unchecked square has only one, because
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
     * @param {number} step - 1 for the next entry, -1 for the previous.
     * @returns {void}
     */
    moveToEntry(step) {
        this.#enter(stepEntry(this.index, this.currentEntry, step));
    }

    /**
     * Moves to the next entry **the same way the cursor is already pointing**, which is what the
     * clue bar's button does.
     *
     * Different from Tab on purpose. Tab walks the printed clue list, so it falls off the end of the
     * Acrosses into the Downs; this stays in the column a solver is working. 7 Down is followed by 8
     * Down, and at the bottom of the Downs it wraps back to the first rather than changing the job.
     *
     * @param {number} [step] - 1 for the next entry, -1 for the previous.
     * @returns {void}
     */
    moveToNextClue(step = 1) {
        this.#enter(stepEntryInDirection(this.index, this.currentEntry, step));
    }

    /** Puts the cursor into an entry, on its first square still empty. */
    #enter(entry) {
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
     * Announced from updated and nowhere else. Selection is owned by the store, so it arrives back
     * here as a property one render later; announcing at the moment of asking would report the
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
     * Caught on the host during capture, so they are taken before the base element's own handler on
     * the grid inside it; letters fall through to that, where they are handled the same as every
     * other type's.
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
     * Caught on the way down, while this.selection is still the square being tapped: the base
     * element's own handler asks the store to move the cursor, and the answer does not come back
     * until the next render, so afterwards there would be no way to tell a re-tap from a first tap.
     *
     * Not gated on interactive, because turning the cursor is navigation and navigation outlives
     * the solve: a finished grid is still a thing people read back, and a board that stops answering
     * taps the moment the last letter lands reads as broken rather than as finished.
     */
    #onCrosswordPointer = (event) => {
        if (!this.doc) return;
        const cell = event.composedPath().find((node) => node.localName === 'pt-cell');
        if (cell && cell.index === this.selection) this.toggleDirection();
    };

    /**
     * Handles the crossword-only keys, letting everything else fall through to the base.
     *
     * Split the way the base element splits it: the keys that only *move* the cursor work whether or
     * not the room is still taking input, and the keys that change the grid are the ones interactive
     * turns off.
     */
    #onCrosswordKey = (event) => {
        if (!this.doc) return;

        if (event.key === 'Tab') {
            this.#take(event);
            this.moveToEntry(event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === 'Enter') {
            this.#take(event);
            this.moveToEntry(1);
            return;
        }
        if (event.key === ' ') {
            this.#take(event);
            this.toggleDirection();
            return;
        }

        if (!this.interactive) return;

        /*
         * Backspace is taken from the base element, which would only clear the square.
         *
         * A crossword's Backspace also steps back along the entry, which is what makes a wrong word
         * walk out of the grid under a held key rather than needing a delete and an arrow per letter.
         */
        if (event.key === 'Backspace') {
            this.#take(event);
            this.backspace();
            return;
        }
        // Delete empties the square without moving off it: the same rule, minus the step back.
        if (event.key === 'Delete') {
            this.#take(event);
            if (this.selection != null) this.#clear(this.selection);
        }
    };

    /** Takes a key for this element: neither the browser nor the base handler sees it. */
    #take(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    /**
     * Backspace: take a letter out, and step back along the entry.
     *
     * Three cases, one rule: *remove one character, and if that emptied the square, move back onto
     * the one before it*:
     *
     * - An ordinary filled square empties and the cursor steps back, so a wrong word walks out of the
     *   grid under a held key rather than needing a delete and an arrow per letter.
     * - A rebus square being assembled loses its last letter and **keeps** the cursor, because the
     *   player is correcting the word they are in the middle of writing.
     * - An empty square has nothing to take, so the step back happens first and the letter comes off
     *   the square landed on.
     *
     * It never leaves the entry. prevInEntry stops at the first square, and a Backspace that
     * silently moved a solver into a different clue would lose them their place, the one thing the
     * cursor rules in this file exist to prevent.
     *
     * Public because the panel's Backspace key presses it too, and there is no version of this rule
     * that a screen can reimplement: the key on the pad and the key on the keyboard have to be the
     * same act (design-spec.md §11).
     *
     * @returns {void}
     */
    backspace() {
        const from = this.selection;
        if (from == null) return;

        const value = effectiveValue(this.doc, this.board, from);
        if (value != null) {
            this.#clear(from);
            // Still holding letters, so the cursor has not finished with this square.
            if (value.length > 1) return;
            const back = prevInEntry(this.index, from, this.direction);
            if (back != null) this.goTo(back);
            return;
        }

        const back = prevInEntry(this.index, from, this.direction);
        if (back == null) return;
        this.goTo(back);
        this.#clear(back);
    }

    /** Asks for a square to give up its last character; the screen decides what that means. */
    #clear(cell) {
        this.dispatchEvent(
            new CustomEvent('pt-cell-clear', { detail: { cell }, bubbles: true, composed: true }),
        );
    }

    /** Whenever the cursor's position or heading settles, the clue bar is told what it is now on. */
    updated(changed) {
        super.updated?.(changed);
        if (changed.has('selection') || changed.has('direction') || changed.has('doc')) {
            this.#announceEntry();
        }
    }
}

customElements.define('pt-crossword-board', PtCrosswordBoard);
