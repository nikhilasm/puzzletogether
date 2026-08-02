/**
 * The landing screen: create a room, or join one with a four-character code.
 *
 * Deliberately two fields and nothing else — the product's appeal is "send a friend a four-letter
 * code", so there is no account, no password, and no signup wall (ADR-0005).
 */

import { LitElement, css, html, nothing } from 'lit';

import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '../../shared/constants.js';
import { roomStore } from '../store/room-store.js';
import { controls } from '../styles/controls.js';

export class PtLanding extends LitElement {
    static properties = {
        prefilledCode: { type: String },
        busy: { state: true },
        error: { state: true },
    };

    static styles = [
        controls,
        css`
            :host {
                display: block;
                text-align: center;
            }

            .tagline {
                margin: 0 0 var(--space-8);
                color: var(--graphite);
            }

            form {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                align-items: center;
                max-width: 320px;
                margin: 0 auto;
            }

            label,
            input {
                width: 100%;
            }

            .divider {
                display: flex;
                gap: var(--space-3);
                align-items: center;
                width: 100%;
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            .divider::before,
            .divider::after {
                flex: 1;
                border-top: var(--border);
                content: '';
            }

            .join {
                display: flex;
                gap: var(--space-2);
                width: 100%;
            }

            .join input {
                flex: 1;
                font-family: var(--font-mono);
                letter-spacing: 0.08em;
                text-transform: lowercase;
            }
        `,
    ];

    constructor() {
        super();
        this.prefilledCode = '';
        this.busy = false;
        this.error = null;
    }

    /** The trimmed name, or null when the field is empty. */
    get #name() {
        const value = this.renderRoot.querySelector('#name')?.value.trim();
        return value || null;
    }

    /** Runs a store action, surfacing failures as a message rather than a console error. */
    async #run(action) {
        this.busy = true;
        this.error = null;
        try {
            const code = await action();
            window.location.hash = `#/room/${code}`;
        } catch (error) {
            this.error = error.message;
        } finally {
            this.busy = false;
        }
    }

    /** Creates a room and takes the host seat. */
    #onCreate(event) {
        event.preventDefault();
        if (!this.#name) {
            this.error = 'enter a name first';
            return;
        }
        void this.#run(() => roomStore.createRoom(this.#name));
    }

    /** Joins the room named in the code field. */
    #onJoin(event) {
        event.preventDefault();
        const code = this.renderRoot.querySelector('#code')?.value.trim().toLowerCase();
        if (!this.#name) {
            this.error = 'enter a name first';
            return;
        }
        if (code?.length !== ROOM_CODE_LENGTH) {
            this.error = `a room code is ${ROOM_CODE_LENGTH} letters`;
            return;
        }
        void this.#run(() => roomStore.joinRoom(this.#name, code));
    }

    render() {
        return html`
            <p class="tagline">Solve one puzzle together, in real time.</p>
            <form @submit=${this.#onCreate}>
                <label for="name">Your name</label>
                <input id="name" maxlength=${MAX_NAME_LENGTH} autocomplete="nickname" required />
                <button type="submit" ?disabled=${this.busy}>Create a room</button>

                <span class="divider">or</span>

                <div class="join">
                    <input
                        id="code"
                        maxlength=${ROOM_CODE_LENGTH}
                        placeholder="code"
                        aria-label="room code"
                        .value=${this.prefilledCode ?? ''}
                    />
                    <button type="button" ?disabled=${this.busy} @click=${this.#onJoin}>
                        Join
                    </button>
                </div>

                ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
            </form>
        `;
    }
}

customElements.define('pt-landing', PtLanding);
