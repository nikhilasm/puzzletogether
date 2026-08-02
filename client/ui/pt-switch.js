/**
 * A labelled on/off switch — the theme toggle and the Notes toggle.
 *
 * Both of those are one setting that is either on or off, so they read as switches rather than as
 * buttons: a button says "do this", a switch says "this is how things are", and the state is legible
 * without reading the label. It holds no state — the owner passes `checked` and reacts to the
 * change, which is what keeps the Notes switch and the store from ever disagreeing.
 *
 * Built on a `<button role="switch">` rather than a styled checkbox, so Space and Enter both
 * activate it and the accessible name comes from the visible label. The `icon` slot takes an
 * `aria-hidden` SVG from `icons.js`.
 */

import { LitElement, css, html } from 'lit';

import { focusRing } from '../styles/controls.js';

export class PtSwitch extends LitElement {
    static properties = {
        checked: { type: Boolean },
        disabled: { type: Boolean },
        label: { type: String },
    };

    static styles = [
        focusRing,
        css`
            /* Shadow roots do not inherit the page's box-sizing reset, and the track's geometry
               depends on it. */
            *,
            *::before,
            *::after {
                box-sizing: border-box;
            }

            :host {
                display: inline-block;
            }

            button {
                display: flex;
                gap: var(--space-2);
                align-items: center;
                min-height: 2.75rem;
                padding: var(--space-1) var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--graphite);
                font-family: var(--font-ui);
                font-size: var(--text-base);
                cursor: pointer;
                touch-action: manipulation;
            }

            button:hover:not(:disabled) {
                border-color: var(--accent);
            }

            button[aria-checked='true'] {
                border-color: var(--accent);
                color: var(--ink);
            }

            button:disabled {
                opacity: 0.5;
                cursor: default;
            }

            /* The slotted icon is sized by the owner; only its layout is this element's business. */
            ::slotted(*) {
                display: flex;
            }

            /* The one round thing here: a switch track is a track, not a box. */
            .track {
                position: relative;
                flex: none;
                width: 2.5rem;
                height: 1.375rem;
                border: var(--border);
                border-radius: var(--radius-round);
                background: var(--paper);
                transition: background var(--motion-mark) ease-out;
            }

            .knob {
                position: absolute;
                top: 50%;
                left: 2px;
                width: 1rem;
                height: 1rem;
                border-radius: var(--radius-round);
                background: var(--graphite);
                transform: translate(0, -50%);
                transition:
                    transform var(--motion-mark) ease-out,
                    background var(--motion-mark) ease-out;
            }

            button[aria-checked='true'] .track {
                background: color-mix(in srgb, var(--accent) 16%, transparent);
            }

            button[aria-checked='true'] .knob {
                background: var(--accent);
                transform: translate(17px, -50%);
            }
        `,
    ];

    constructor() {
        super();
        this.checked = false;
        this.disabled = false;
        this.label = '';
    }

    /** Announces the state the player asked for; the owner decides whether it takes. */
    #onClick() {
        this.dispatchEvent(
            new CustomEvent('pt-switch-change', {
                detail: { checked: !this.checked },
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <button
                type="button"
                role="switch"
                aria-checked=${this.checked}
                ?disabled=${this.disabled}
                @click=${this.#onClick}
            >
                <slot name="icon"></slot>
                <span class="label">${this.label}</span>
                <span class="track"><span class="knob"></span></span>
            </button>
        `;
    }
}

customElements.define('pt-switch', PtSwitch);
