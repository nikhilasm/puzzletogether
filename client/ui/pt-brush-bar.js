/**
 * The nonogram input control: which of the three marks a tap or a drag lays down.
 *
 * This is the keypad's slot, holding what a nonogram has instead of digits (design-spec.md §4). It is
 * a *tri-toggle* rather than three buttons that do something, because picking a brush changes what
 * the grid does next rather than changing the grid — the same reason Notes is a switch and Check is a
 * button (brand.md §4). Three mutually exclusive states is one more than a switch can hold, so it
 * takes the `aria-pressed` option-group pattern the puzzle pickers use.
 *
 * Nonogram has no Notes switch above this: a cross *is* the note, so the thing that would have been a
 * mode is one of the three brushes instead.
 */

import { LitElement, css, html } from 'lit';

import { controls, optionGroup } from '../styles/controls.js';

import { closeIcon, eraseIcon, fillIcon, iconStyle } from './icons.js';

/** The three brushes, in the order a solver reaches for them. */
const BRUSHES = [
    { id: 'fill', label: 'Fill', icon: fillIcon },
    { id: 'cross', label: 'Cross', icon: closeIcon },
    { id: 'erase', label: 'Erase', icon: eraseIcon },
];

export class PtBrushBar extends LitElement {
    static properties = {
        brush: { type: String },
        disabled: { type: Boolean },
    };

    static styles = [
        controls,
        optionGroup,
        iconStyle,
        css`
            :host {
                display: block;
            }

            /* Keypad-sized targets: this is the control a thumb spends the whole puzzle on. */
            .option {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
                justify-content: center;
                min-width: 6rem;
                min-height: 2.75rem;
                touch-action: manipulation;
            }
        `,
    ];

    constructor() {
        super();
        this.brush = 'fill';
        this.disabled = false;
    }

    /**
     * Keeps the grid's keyboard focus where it is when a brush is tapped.
     *
     * Without this the grid blurs, arrow keys stop working after any brush change, and on touch the
     * selection appears to jump — the same reason the keypad does it.
     */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces the brush the player picked; the store decides whether it takes. */
    #emit(brush) {
        this.dispatchEvent(
            new CustomEvent('pt-brush-change', {
                detail: { brush },
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <div class="options" role="group" aria-label="what a tap draws">
                ${BRUSHES.map(
                    (brush) => html`
                        <button
                            type="button"
                            class="option"
                            aria-pressed=${this.brush === brush.id}
                            ?disabled=${this.disabled}
                            @pointerdown=${this.#onPointerDown}
                            @click=${() => this.#emit(brush.id)}
                        >
                            ${brush.icon} ${brush.label}
                        </button>
                    `,
                )}
            </div>
        `;
    }
}

customElements.define('pt-brush-bar', PtBrushBar);
