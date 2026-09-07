/**
 * The input panel: the keys this puzzle is typed with, the actions that act on a square, and a
 * crossword's current clue, pinned to the bottom for every type (ADR-0010). Everything acting on a
 * square is here while Check, Reveal, and Puzzle Select stay down the page; it reports its own
 * height since it is out of the flow (ADR-0012, design-spec.md §4).
 */

import { LitElement, css, html, nothing } from 'lit';

import { actionButton, focusRing } from '../styles/controls.js';

import { backspaceIcon, eraseIcon, iconStyle, undoIcon } from './icons.js';

/**
 * The letter keys, in the order every phone puts them. QWERTY not A to Z, since a solver's muscle
 * memory is worth more than the easier search of alphabetical rows.
 */
const LETTER_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export class PtKeypad extends LitElement {
    static properties = {
        /** Which keys this puzzle accepts. Empty for a type that has none, like nonogram. */
        alphabet: { type: String },
        /** 'digits' for one even grid of keys, 'letters' for the three staggered QWERTY rows. */
        layout: { type: String },
        counts: { type: Object },
        /** Max legal count per key, e.g. { '1': 9, '2': 9 }. A key missing from this never dims. */
        capacities: { type: Object },
        canUndo: { type: Boolean },
        disabled: { type: Boolean },
    };

    static styles = [
        actionButton,
        focusRing,
        iconStyle,
        css`
            /* Pinned to the bottom of the viewport, with safe-area padding so the last row of keys
               clears the iPhone home indicator. */
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

            /* The button bar, always one row: the controls share the row rather than each taking its
               label's width, so four fit 320px without wrapping. */
            .actions {
                display: flex;
                gap: var(--space-2);
                align-items: stretch;
                justify-content: center;
            }

            .digits {
                display: grid;
                grid-template-columns: repeat(var(--keypad-cols, 9), minmax(0, 1fr));
                gap: var(--space-2);
            }

            /* The letter rows, flex rather than a column grid so each key takes a ten-key row's
               width and the shorter rows centre under it, as a real keyboard does. */
            .letters {
                display: flex;
                flex-direction: column;
                gap: var(--space-1);
            }

            .row {
                display: flex;
                gap: var(--space-1);
                justify-content: center;
            }

            .row button {
                flex: 0 1 calc((100% - 9 * var(--space-1)) / 10);
                min-width: 0;
                padding: var(--space-2) 0;
                font-size: var(--text-base);
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
                /* Our own :active ground replaces the platform's tap flash; see controls.js. */
                -webkit-tap-highlight-color: transparent;
            }

            /* Behind the hover gate like every hover rule in the app, or a tapped key keeps its
               accent border until the next tap (see controls.js). */
            @media (hover: hover) {
                button:hover:not(:disabled) {
                    border-color: var(--accent);
                }
            }

            /* A ground under the finger instead, gone on release, on the most-tapped thing in the
               app. */
            button:active:not(:disabled) {
                background: color-mix(in srgb, var(--ink) 10%, var(--paper-raised));
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

            /* Below this the digits wrap to roughly half as many columns to keep tap targets big;
               the letter rows are already sized to the narrowest screen. */
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
        this.capacities = {};
        this.canUndo = false;
        this.disabled = false;
    }

    /**
     * Reports how much of the screen this panel is covering, since it is position: fixed and takes
     * no room in the flow, so the owner keeps a spacer this tall at the foot of the page. Measured
     * rather than declared, since a crossword's panel is taller than a sudoku's.
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
     * Keeps the grid's keyboard focus where it is when a key is tapped. Without this the grid blurs
     * and arrow keys stop working after any keypad press.
     */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces a key press; the store decides what it means in the current mode. */
    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    /**
     * The clue strip, the button bar, and the keys, in that order, bottom-anchored so the keys sit
     * closest to the thumb. Every type gets Undo in the bar, a keyed type gets Erase, and a
     * crossword gets Backspace there instead, since all three act on a square rather than being a
     * letter.
     */
    render() {
        const letters = this.layout === 'letters';
        const keys = [...this.alphabet];

        return html`
            <div class="panel">
                <slot name="clue"></slot>
                <div class="actions">
                    <slot name="actions"></slot>
                    ${keys.length > 0 && !letters ? this.#renderErase() : nothing}
                    ${this.#renderUndo()} ${letters ? this.#renderBackspace() : nothing}
                </div>
                ${letters ? this.#renderLetters() : this.#renderDigits(keys)}
            </div>
        `;
    }

    /**
     * Undo, which every type has and which is the one fixed point in the bar. A crossword puts
     * Backspace after it, since that is reached for mid-word while Undo is pressed occasionally.
     */
    #renderUndo() {
        return html`
            <button
                type="button"
                class="action"
                aria-label="Undo"
                ?disabled=${this.disabled || !this.canUndo}
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-undo', {})}
            >
                ${undoIcon}<span class="action-label">Undo</span>
            </button>
        `;
    }

    /** Clears the selected square outright: the counterpart to pressing a key into it. */
    #renderErase() {
        return html`
            <button
                type="button"
                class="action"
                aria-label="Erase"
                ?disabled=${this.disabled}
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-erase', {})}
            >
                ${eraseIcon}<span class="action-label">Erase</span>
            </button>
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
     * The three QWERTY rows: letters and nothing else, since Backspace lives in the button bar.
     * Rows are filtered by the puzzle's alphabet, so a key the puzzle would refuse is never offered.
     */
    #renderLetters() {
        const allowed = this.alphabet === '' ? null : [...this.alphabet];
        const rows = LETTER_ROWS.map((row) =>
            [...row].filter((key) => allowed === null || allowed.includes(key)),
        );

        return html`<div class="letters" role="group" aria-label="letters">
            ${rows.map(
                (row) => html`<div class="row">${row.map((key) => this.#renderKey(key))}</div>`,
            )}
        </div>`;
    }

    /** One key, dimmed once the grid already holds as many of it as it can. */
    #renderKey(key) {
        const placed = this.counts?.[key] ?? 0;
        const capacity = this.capacities?.[key];
        const remaining = capacity == null ? null : Math.max(0, capacity - placed);
        const isExhausted = remaining === 0;

        return html`
            <button
                type="button"
                ?data-exhausted=${isExhausted}
                ?disabled=${this.disabled}
                aria-label=${remaining == null ? key : `${key}, ${remaining} remaining`}
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-key', { value: key })}
            >
                ${key}
            </button>
        `;
    }

    /** Backspace, which takes a letter out and steps back; the board decides what that means. */
    #renderBackspace() {
        return html`
            <button
                type="button"
                class="action"
                aria-label="Backspace"
                ?disabled=${this.disabled}
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-backspace', {})}
            >
                ${backspaceIcon}<span class="action-label">Backspace</span>
            </button>
        `;
    }
}

customElements.define('pt-keypad', PtKeypad);
