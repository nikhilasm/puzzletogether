/**
 * The nonogram input control: which of the three marks a tap or drag lays down, the keypad's slot
 * for a type that has no digits (design-spec.md §4). A tri-toggle of mutually exclusive aria-pressed
 * buttons following the app's toggle pattern (ADR-0011), on a display: contents host so the three
 * buttons share the panel's row on equal terms.
 */

import { LitElement, css, html } from 'lit';

import { actionButton, focusRing } from '../styles/controls.js';

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
        actionButton,
        focusRing,
        iconStyle,
        css`
            :host {
                display: contents;
            }
        `,
    ];

    constructor() {
        super();
        this.brush = 'fill';
        this.disabled = false;
    }

    /**
     * Names the group on the host, since display: contents means this element draws no box for a
     * <div role="group"> to be. The role has to reach the light DOM to survive that, which is why
     * it is set here rather than in the template.
     */
    connectedCallback() {
        super.connectedCallback();
        this.setAttribute('role', 'group');
        this.setAttribute('aria-label', 'what a tap draws');
    }

    /**
     * Keeps the grid's keyboard focus where it is when a brush is tapped.
     *
     * Without this the grid blurs, arrow keys stop working after any brush change, and on touch the
     * selection appears to jump, the same reason the keypad does it.
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
            ${BRUSHES.map(
                (brush) => html`
                    <button
                        type="button"
                        class="action"
                        aria-pressed=${this.brush === brush.id}
                        ?disabled=${this.disabled}
                        @pointerdown=${this.#onPointerDown}
                        @click=${() => this.#emit(brush.id)}
                    >
                        ${brush.icon}<span class="action-label">${brush.label}</span>
                    </button>
                `,
            )}
        `;
    }
}

customElements.define('pt-brush-bar', PtBrushBar);
