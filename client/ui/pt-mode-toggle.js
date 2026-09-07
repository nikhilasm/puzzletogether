/**
 * The Notes toggle: whether a digit press writes a pencil mark or a value, one control since Solve
 * is simply Notes being off. A pressed button rather than a role=switch so it announces a state and
 * matches the brushes beside it (ADR-0011, ADR-0012), on a display: contents host so it shares the
 * panel's row, with the mode living in the store.
 */

import { LitElement, css, html } from 'lit';

import { INPUT_MODE } from '../../shared/protocol.js';
import { actionButton, focusRing } from '../styles/controls.js';

import { iconStyle, pencilIcon } from './icons.js';

export class PtModeToggle extends LitElement {
    static properties = {
        mode: { type: String },
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
        this.mode = INPUT_MODE.SOLVE;
        this.disabled = false;
    }

    /**
     * Keeps the grid's keyboard focus where it is when the toggle is tapped.
     *
     * The same rule every control in the input panel follows: this sits beside the keys, and a
     * setting that silently blurred the grid would mean the next thing typed at the puzzle went
     * nowhere.
     */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces the mode the player picked; the store decides whether it takes. */
    #onClick() {
        const notes = this.mode === INPUT_MODE.NOTES;
        this.dispatchEvent(
            new CustomEvent('pt-mode-change', {
                detail: { mode: notes ? INPUT_MODE.SOLVE : INPUT_MODE.NOTES },
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <button
                type="button"
                class="action"
                aria-pressed=${this.mode === INPUT_MODE.NOTES}
                ?disabled=${this.disabled}
                @pointerdown=${this.#onPointerDown}
                @click=${this.#onClick}
            >
                ${pencilIcon}<span class="action-label">Notes</span>
            </button>
        `;
    }
}

customElements.define('pt-mode-toggle', PtModeToggle);
