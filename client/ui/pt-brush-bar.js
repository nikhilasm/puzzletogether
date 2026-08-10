/**
 * The nonogram input control: which of the three marks a tap or a drag lays down.
 *
 * This is the keypad's slot, holding what a nonogram has instead of digits (design-spec.md §4). It is
 * a *tri-toggle* rather than three buttons that do something, because picking a brush changes what
 * the grid does next rather than changing the grid — the same reason Notes is a toggle and Check is a
 * button (brand.md §4).
 *
 * **This bar is where the app's toggle pattern started**, and as of ADR-0011 it is where every other
 * setting has arrived: mutually exclusive `aria-pressed` buttons, the pressed one carrying an accent
 * border and a 16% accent wash. Notes and Rebus were switches with tracks until they were made to
 * look like these.
 *
 * **The host is `display: contents`**, so the three buttons are direct children of the panel's
 * button bar rather than a box inside it. Boxed, the three brushes were one flex item against Undo's
 * one and took half the row between them; unboxed, all four are the same width. The group's name
 * moves onto the host, since the element that carried it no longer draws a box.
 *
 * Nonogram has no Notes toggle above this: a cross *is* the note, so the thing that would have been a
 * mode is one of the three brushes instead.
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
     * Names the group on the host, since `display: contents` means this element draws no box for a
     * `<div role="group">` to be. The role has to reach the light DOM to survive that, which is why
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
