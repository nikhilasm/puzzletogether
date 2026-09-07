/**
 * The landing screen: create a room, or join one with a four-character code, two fields and no
 * account or signup wall (ADR-0005). The two paths sit behind tabs so it is one question at a time,
 * with the name input rendered once outside the branch so it keeps what you typed.
 */

import { LitElement, css, html, nothing } from 'lit';

import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '../../shared/constants.js';
import { roomStore } from '../store/room-store.js';
import { controls } from '../styles/controls.js';

/** The two things you can do from here. */
const TAB = { CREATE: 'create', JOIN: 'join' };

export class PtLanding extends LitElement {
    static properties = {
        prefilledCode: { type: String },
        tab: { state: true },
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
                margin: 0 0 var(--space-6);
                color: var(--graphite);
            }

            .tabs {
                display: flex;
                gap: var(--space-6);
                justify-content: center;
                max-width: 320px;
                margin: 0 auto var(--space-6);
                border-bottom: var(--border);
            }

            /* Text with a rule under it rather than a pair of buttons, since these name which half of
               one form you are looking at rather than being two actions. */
            .tab {
                padding: var(--space-2) var(--space-2);
                border: none;
                border-bottom: 2px solid transparent;
                border-radius: 0;
                background: none;
                color: var(--graphite);
                /* Sits over the group's own rule, so the marker replaces it rather than doubling. */
                margin-bottom: -1.5px;
            }

            @media (hover: hover) {
                .tab:hover:not([aria-selected='true']) {
                    border-bottom-color: var(--rule);
                    color: var(--ink);
                }
            }

            .tab[aria-selected='true'] {
                border-bottom-color: var(--accent);
                color: var(--ink);
                font-weight: 700;
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

            #code {
                font-family: var(--font-mono);
                letter-spacing: 0.08em;
                text-transform: lowercase;
            }
        `,
    ];

    constructor() {
        super();
        this.prefilledCode = '';
        this.tab = TAB.CREATE;
        this.busy = false;
        this.error = null;
    }

    /**
     * Opens on Join when the URL already named a room.
     *
     * That is how somebody who followed a link but has no seat arrives here, and Create would be
     * the wrong answer to the question they were asking.
     */
    willUpdate(changed) {
        if (changed.has('prefilledCode') && this.prefilledCode) this.tab = TAB.JOIN;
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

    /** Submits whichever tab is open; both paths need a name first. */
    #onSubmit(event) {
        event.preventDefault();
        if (!this.#name) {
            this.error = 'enter a name first';
            return;
        }
        if (this.tab === TAB.CREATE) {
            void this.#run(() => roomStore.createRoom(this.#name));
            return;
        }

        const code = this.renderRoot.querySelector('#code')?.value.trim().toLowerCase();
        if (code?.length !== ROOM_CODE_LENGTH) {
            this.error = `a room code is ${ROOM_CODE_LENGTH} letters`;
            return;
        }
        void this.#run(() => roomStore.joinRoom(this.#name, code));
    }

    /** Switches tabs, dropping any error that belonged to the other one. */
    #select(tab) {
        this.tab = tab;
        this.error = null;
    }

    /** Left/Right move between tabs, which is what the tablist pattern promises a keyboard user. */
    #onTabKeyDown(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();

        const next = this.tab === TAB.CREATE ? TAB.JOIN : TAB.CREATE;
        this.#select(next);
        this.updateComplete.then(() => this.renderRoot.querySelector(`#tab-${next}`)?.focus());
    }

    render() {
        const isJoin = this.tab === TAB.JOIN;

        return html`
            <p class="tagline">Solve one puzzle together, in real time.</p>

            <div class="tabs" role="tablist" aria-label="Create or join a room">
                ${this.#renderTab(TAB.CREATE, 'Create')} ${this.#renderTab(TAB.JOIN, 'Join')}
            </div>

            <form
                role="tabpanel"
                id="panel-${this.tab}"
                aria-labelledby="tab-${this.tab}"
                @submit=${this.#onSubmit}
            >
                <label for="name">Your name</label>
                <input id="name" maxlength=${MAX_NAME_LENGTH} autocomplete="nickname" required />

                ${
                    isJoin
                        ? html`
                              <label for="code">Room code</label>
                              <input
                                  id="code"
                                  maxlength=${ROOM_CODE_LENGTH}
                                  autocomplete="off"
                                  .value=${this.prefilledCode ?? ''}
                              />
                          `
                        : nothing
                }

                <button type="submit" ?disabled=${this.busy}>
                    ${isJoin ? 'Join room' : 'Create a room'}
                </button>

                ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
            </form>
        `;
    }

    /** One tab. Only the selected one is in the tab order, per the ARIA tablist pattern. */
    #renderTab(tab, label) {
        const isSelected = this.tab === tab;
        return html`
            <button
                class="tab"
                id="tab-${tab}"
                type="button"
                role="tab"
                aria-selected=${isSelected}
                aria-controls="panel-${tab}"
                tabindex=${isSelected ? 0 : -1}
                @click=${() => this.#select(tab)}
                @keydown=${this.#onTabKeyDown}
            >
                ${label}
            </button>
        `;
    }
}

customElements.define('pt-landing', PtLanding);
