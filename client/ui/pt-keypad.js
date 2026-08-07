/**
 * The input panel: the keys this puzzle is typed with, the actions that act on a square, and — for a
 * crossword — the clue being worked. Pinned to the bottom of the screen for every puzzle type.
 *
 * **Fixed rather than laid out with the page**, which is the whole point of it (ADR-0010). A control
 * in the flow is a control that scrolls away, and a big grid on a small screen has to be scrolled: a
 * 15×15 crossword and a 20×20 nonogram are both taller than a phone. Pinning the keys means the grid
 * above them can be scrolled and read freely while the ability to type never goes anywhere.
 *
 * Everything that acts on a *square* is here — keys, Erase, Undo, and whatever setting changes what a
 * key means. Everything that acts on the *puzzle* — Check, Reveal, Puzzle Select — stays down the
 * page, which is the separation §4 has drawn since Phase 2, now expressed as two different kinds of
 * place rather than as a rule under a hairline.
 *
 * Two slots, both above the keys, because what goes in them differs per type and this element has no
 * business knowing which type it is serving: `clue` for the strip a crossword shows, and `actions`
 * for its one setting — Notes, a brush, Rebus. Erase and Undo are rendered here instead of slotted
 * because they mean the same thing in every puzzle that has keys at all.
 *
 * It also reports its own height, since it is out of the flow and so cannot push the page down
 * itself; the game screen keeps a spacer that tall at the foot of the page.
 */

import { LitElement, css, html, nothing } from 'lit';

import { focusRing } from '../styles/controls.js';

import { backspaceIcon, eraseIcon, iconStyle, undoIcon } from './icons.js';

/**
 * The letter keys, in the order every phone puts them.
 *
 * QWERTY and not A–Z. Alphabetical rows are easier to *search*, which sounds like the right thing
 * until you notice nobody searches a keyboard they have used ten thousand times — the muscle memory
 * a solver already has is worth more than any arrangement we could reason our way to, and it is the
 * one thing an on-screen pad can borrow from the platform keyboard it replaces.
 */
const LETTER_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export class PtKeypad extends LitElement {
    static properties = {
        /** Which keys this puzzle accepts. Empty for a type that has none, like nonogram. */
        alphabet: { type: String },
        /** `'digits'` for one even grid of keys, `'letters'` for the three staggered QWERTY rows. */
        layout: { type: String },
        counts: { type: Object },
        capacity: { type: Number },
        canUndo: { type: Boolean },
        disabled: { type: Boolean },
    };

    static styles = [
        focusRing,
        iconStyle,
        css`
            /*
             * Pinned to the bottom of the viewport, over whatever the page has scrolled to.
             *
             * The safe-area padding is for the iPhone home indicator, which draws over the bottom
             * few millimetres of the screen — without it the last row of keys is under the bar the
             * player swipes to leave the app, and the two gestures fight.
             */
            :host {
                position: fixed;
                right: 0;
                bottom: 0;
                left: 0;
                z-index: 5;
                border-top: var(--border);
                background: var(--paper-raised);
                padding-bottom: env(safe-area-inset-bottom, 0px);
            }

            .panel {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                max-width: 34rem;
                margin: 0 auto;
                padding: var(--space-2) var(--space-3);
            }

            /* Slotted controls should be laid out by the row they land in, not wrapped in a box of
               their own. */
            slot {
                display: contents;
            }

            /*
             * The button bar: this puzzle's setting, then the two actions every keyed puzzle has.
             *
             * It wraps rather than shrinking, because a 320px phone cannot fit a switch and two
             * labelled buttons on one line and a squeezed tap target is worse than a second row.
             */
            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-2);
                align-items: center;
                justify-content: center;
            }

            .digits {
                display: grid;
                grid-template-columns: repeat(var(--keypad-cols, 9), minmax(0, 1fr));
                gap: var(--space-2);
            }

            /*
             * The letter rows, staggered.
             *
             * Twenty half-columns rather than ten whole ones, so the nine-key row can start half a
             * key in — which is what makes three rows of different lengths read as a keyboard rather
             * than as three unrelated rows of buttons. Backspace takes the width the last row has
             * spare, which is where a phone keyboard puts it too.
             */
            .letters {
                display: grid;
                gap: var(--space-1);
            }

            .row {
                display: grid;
                grid-template-columns: repeat(20, minmax(0, 1fr));
                gap: var(--space-1);
            }

            .row button {
                grid-column: span 2;
                padding: var(--space-2) 0;
                font-size: var(--text-base);
            }

            .row:not(:first-child) button:first-child {
                grid-column-start: 2;
            }

            .row .wide {
                display: flex;
                grid-column: span 4;
                align-items: center;
                justify-content: center;
            }

            button {
                min-height: 2.75rem;
                padding: var(--space-2) var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-lg);
                font-variant-numeric: tabular-nums;
                cursor: pointer;
                touch-action: manipulation;
            }

            .actions button {
                display: flex;
                gap: var(--space-2);
                align-items: center;
                justify-content: center;
                min-width: 5rem;
                font-size: var(--text-base);
            }

            button:hover:not(:disabled) {
                border-color: var(--accent);
            }

            /* Placed as often as the grid allows: still pressable, just no longer suggested. */
            button[data-exhausted] {
                color: var(--graphite);
                opacity: 0.45;
            }

            button:disabled {
                color: var(--graphite);
                opacity: 0.45;
                cursor: default;
            }

            /* Below this the digits wrap to roughly half as many columns, to keep tap targets big.
               The letter rows do not wrap: they are already sized to the narrowest screen. */
            @media (max-width: 30rem) {
                .digits {
                    grid-template-columns: repeat(var(--keypad-cols-narrow, 5), minmax(0, 1fr));
                }
            }
        `,
    ];

    /** Watches the panel's own height, which the page needs and cannot measure for itself. */
    #resizeObserver = null;

    /** The last height announced, so an unchanged measurement does not re-render the screen. */
    #reportedHeight = 0;

    constructor() {
        super();
        this.alphabet = '';
        this.layout = 'digits';
        this.counts = {};
        this.capacity = 0;
        this.canUndo = false;
        this.disabled = false;
    }

    /**
     * Reports how much of the screen this panel is covering.
     *
     * It is `position: fixed`, so it takes no room in the flow and the last few rems of the page
     * would sit underneath it — on the game screen that is Leave room. The owner puts a spacer this
     * tall at the foot of the page instead. Measured rather than declared because the height is not
     * knowable in advance: a crossword's panel is three rows of letters and a clue taller than a
     * sudoku's, and the button bar wraps on a narrow screen.
     */
    firstUpdated() {
        if (typeof ResizeObserver === 'undefined') return;
        this.#resizeObserver = new ResizeObserver(() => this.#reportHeight());
        this.#resizeObserver.observe(this);
    }

    disconnectedCallback() {
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        super.disconnectedCallback();
    }

    /** Announces the panel's height, ignoring sub-pixel noise that would only cost a render. */
    #reportHeight() {
        const height = this.getBoundingClientRect().height;
        if (Math.abs(height - this.#reportedHeight) < 1) return;
        this.#reportedHeight = height;
        this.#emit('pt-keypad-resize', { height });
    }

    /**
     * Keeps the grid's keyboard focus where it is when a key is tapped.
     *
     * Without this the grid blurs, arrow keys stop working after any keypad press, and on touch the
     * selection appears to jump. Click and keyboard activation are unaffected.
     */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces a key press; the store decides what it means in the current mode. */
    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    /**
     * The clue strip, the button bar, and the keys — in that order, bottom-anchored.
     *
     * The keys go last so they sit closest to the thumb, which is the busiest thing here by an order
     * of magnitude. Everything above them is read between keystrokes rather than during them.
     *
     * A puzzle with no keys at all still gets the button bar, because **Undo belongs to every type**.
     * Erase does not: it clears the selected square, which is the counterpart to pressing a key into
     * it, so a type with no keys has no use for it — nonogram erases by dragging with its erase brush,
     * and a second Erase here would be a different gesture wearing the same word. Nor does a
     * crossword, whose Backspace key is that control and sits on the pad where a keyboard puts it.
     */
    render() {
        const letters = this.layout === 'letters';
        const keys = [...this.alphabet];

        return html`
            <div class="panel">
                <slot name="clue"></slot>
                <div class="actions">
                    <slot name="actions"></slot>
                    ${
                        keys.length > 0 && !letters
                            ? html`<button
                                  type="button"
                                  ?disabled=${this.disabled}
                                  @pointerdown=${this.#onPointerDown}
                                  @click=${() => this.#emit('pt-keypad-erase', {})}
                              >
                                  ${eraseIcon} Erase
                              </button>`
                            : nothing
                    }
                    <button
                        type="button"
                        ?disabled=${this.disabled || !this.canUndo}
                        @pointerdown=${this.#onPointerDown}
                        @click=${() => this.#emit('pt-keypad-undo', {})}
                    >
                        ${undoIcon} Undo
                    </button>
                </div>
                ${letters ? this.#renderLetters() : this.#renderDigits(keys)}
            </div>
        `;
    }

    /** One even grid of keys, for the types whose alphabet is short enough to show at once. */
    #renderDigits(keys) {
        if (keys.length === 0) return nothing;

        const narrowCols = keys.length > 5 ? Math.ceil(keys.length / 2) : keys.length;
        const style = `--keypad-cols: ${keys.length}; --keypad-cols-narrow: ${narrowCols};`;

        return html`<div class="digits" style=${style} role="group" aria-label="digits">
            ${keys.map((key) => this.#renderKey(key))}
        </div>`;
    }

    /**
     * The three QWERTY rows, with Backspace on the end of the last.
     *
     * Rows are filtered by the puzzle's alphabet rather than drawn as written, so a key the puzzle
     * would refuse is never offered. For every crossword we serve that filter is the identity.
     */
    #renderLetters() {
        const allowed = this.alphabet === '' ? null : [...this.alphabet];
        const rows = LETTER_ROWS.map((row) =>
            [...row].filter((key) => allowed === null || allowed.includes(key)),
        );

        return html`<div class="letters" role="group" aria-label="letters">
            ${rows.map(
                (row, index) => html`
                    <div class="row">
                        ${row.map((key) => this.#renderKey(key))}
                        ${index === rows.length - 1 ? this.#renderBackspace() : nothing}
                    </div>
                `,
            )}
        </div>`;
    }

    /** One key, dimmed once the grid already holds as many of it as it can. */
    #renderKey(key) {
        const placed = this.counts?.[key] ?? 0;
        const remaining = Math.max(0, this.capacity - placed);
        const isExhausted = this.capacity > 0 && remaining === 0;

        return html`
            <button
                type="button"
                ?data-exhausted=${isExhausted}
                ?disabled=${this.disabled}
                aria-label=${this.capacity > 0 ? `${key}, ${remaining} remaining` : key}
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-key', { value: key })}
            >
                ${key}
            </button>
        `;
    }

    /** Backspace, which takes a letter out and steps back — the board decides what that means. */
    #renderBackspace() {
        return html`
            <button
                type="button"
                class="wide"
                aria-label="Backspace"
                ?disabled=${this.disabled}
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-backspace', {})}
            >
                ${backspaceIcon}
            </button>
        `;
    }
}

customElements.define('pt-keypad', PtKeypad);
