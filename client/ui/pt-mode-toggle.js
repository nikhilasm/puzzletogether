/**
 * The Notes toggle: whether a digit press writes a pencil mark or a value.
 *
 * One control, not two, because there is only one setting here and Solve is simply Notes being off —
 * a `Notes | Solve` pair implied two independent things to choose between. Solving is the default
 * state, so it reads as "am I making notes right now?".
 *
 * **A pressed button rather than a `role="switch"`** (ADR-0011). It was a switch for two phases, on
 * the argument that a setting should announce itself as a state rather than as an action — which is
 * true, and which `aria-pressed` also does. What the switch additionally needed was a track wide
 * enough to show a knob moving and a word to sit beside it, and in a pinned panel with four other
 * controls that was the whole of its cost. It now looks and reports exactly like the brushes beside
 * it, which were an `aria-pressed` group from the day nonogram shipped. It keeps its word, though —
 * that half of ADR-0011 was reverted, because dropping the labels bought no vertical space.
 *
 * **The host is `display: contents`**, so the button inside it is a direct child of the panel's
 * button bar and shares the row on the same terms as Erase and Undo. Wrapped in a box of its own it
 * would have been one flex item against their two, and Notes would have come out half the row wide.
 *
 * Holds no state of its own — the mode lives in the store, so the keypad, the physical keyboard,
 * and this control can never disagree about which one is in force.
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
