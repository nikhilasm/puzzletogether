/**
 * The Notes switch: whether a digit press writes a pencil mark or a value.
 *
 * A switch rather than a `Notes | Solve` pair, because there is only one setting here and Solve is
 * simply Notes being off — two segments implied two independent things to choose between. Solving
 * is the default state, so the switch reads as "am I making notes right now?".
 *
 * Holds no state of its own — the mode lives in the store, so the keypad, the physical keyboard,
 * and this control can never disagree about which one is in force.
 */

import { LitElement, css, html } from 'lit';

import { INPUT_MODE } from '../../shared/protocol.js';

import { iconStyle, pencilIcon } from './icons.js';
import './pt-switch.js';

export class PtModeToggle extends LitElement {
    static properties = {
        mode: { type: String },
        disabled: { type: Boolean },
    };

    static styles = [
        iconStyle,
        css`
            :host {
                display: block;
            }
        `,
    ];

    constructor() {
        super();
        this.mode = INPUT_MODE.SOLVE;
        this.disabled = false;
    }

    /**
     * Keeps the grid's keyboard focus where it is when the switch is tapped.
     *
     * The same rule every control in the input panel follows: this sits beside the keys now, and a
     * setting that silently blurred the grid would mean the next thing typed at the puzzle went
     * nowhere.
     */
    #onPointerDown(event) {
        event.preventDefault();
    }

    /** Announces the mode the player picked; the store decides whether it takes. */
    #onChange(event) {
        this.dispatchEvent(
            new CustomEvent('pt-mode-change', {
                detail: { mode: event.detail.checked ? INPUT_MODE.NOTES : INPUT_MODE.SOLVE },
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <pt-switch
                label="Notes"
                .checked=${this.mode === INPUT_MODE.NOTES}
                .disabled=${this.disabled}
                @pointerdown=${this.#onPointerDown}
                @pt-switch-change=${this.#onChange}
            >
                <span slot="icon">${pencilIcon}</span>
            </pt-switch>
        `;
    }
}

customElements.define('pt-mode-toggle', PtModeToggle);
