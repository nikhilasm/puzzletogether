/**
 * The on-screen keypad: the puzzle's digits, plus Erase and Undo.
 *
 * Visible on desktop as well as touch, because it doubles as an affordance for which digits are
 * still available — a digit already placed as often as the grid allows is dimmed (design-spec.md
 * §4). It emits intent and routes through the same store methods as the physical keyboard, so
 * there is exactly one input path.
 *
 * Undo lives here rather than beside Check and Reveal so every way of changing a cell is in one
 * place, and so it is reachable on a phone.
 */

import { LitElement, css, html, nothing } from 'lit';

import { focusRing } from '../styles/controls.js';

import { eraseIcon, iconStyle, undoIcon } from './icons.js';

export class PtKeypad extends LitElement {
    static properties = {
        alphabet: { type: String },
        counts: { type: Object },
        capacity: { type: Number },
        canUndo: { type: Boolean },
        disabled: { type: Boolean },
    };

    static styles = [
        focusRing,
        iconStyle,
        css`
            :host {
                display: block;
            }

            .digits {
                display: grid;
                grid-template-columns: repeat(var(--keypad-cols, 9), minmax(0, 1fr));
                gap: var(--space-2);
                margin-bottom: var(--space-3);
            }

            .actions {
                display: flex;
                gap: var(--space-2);
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
                min-width: 6rem;
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

            /* Below this the digits wrap to roughly half as many columns, to keep tap targets big. */
            @media (max-width: 30rem) {
                .digits {
                    grid-template-columns: repeat(var(--keypad-cols-narrow, 5), minmax(0, 1fr));
                }
            }
        `,
    ];

    constructor() {
        super();
        this.alphabet = '';
        this.counts = {};
        this.capacity = 0;
        this.canUndo = false;
        this.disabled = false;
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

    render() {
        const digits = [...this.alphabet];
        if (digits.length === 0) return nothing;

        const narrowCols = digits.length > 5 ? Math.ceil(digits.length / 2) : digits.length;
        const style = `--keypad-cols: ${digits.length}; --keypad-cols-narrow: ${narrowCols};`;

        return html`
            <div class="digits" style=${style} role="group" aria-label="digits">
                ${digits.map((digit) => this.#renderDigit(digit))}
            </div>
            <div class="actions">
                <button
                    type="button"
                    ?disabled=${this.disabled}
                    @pointerdown=${this.#onPointerDown}
                    @click=${() => this.#emit('pt-keypad-erase', {})}
                >
                    ${eraseIcon} Erase
                </button>
                <button
                    type="button"
                    ?disabled=${this.disabled || !this.canUndo}
                    @pointerdown=${this.#onPointerDown}
                    @click=${() => this.#emit('pt-keypad-undo', {})}
                >
                    ${undoIcon} Undo
                </button>
            </div>
        `;
    }

    /** One digit key, dimmed once the grid already holds as many of it as it can. */
    #renderDigit(digit) {
        const placed = this.counts?.[digit] ?? 0;
        const remaining = Math.max(0, this.capacity - placed);
        const isExhausted = this.capacity > 0 && remaining === 0;

        return html`
            <button
                type="button"
                ?data-exhausted=${isExhausted}
                ?disabled=${this.disabled}
                aria-label="${digit}, ${remaining} remaining"
                @pointerdown=${this.#onPointerDown}
                @click=${() => this.#emit('pt-keypad-digit', { value: digit })}
            >
                ${digit}
            </button>
        `;
    }
}

customElements.define('pt-keypad', PtKeypad);
