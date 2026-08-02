/**
 * Root element and router: the wordmark, the room header, the current screen, and the footer.
 *
 * The router is a hash router by design — `#/room/kqjy` is a link you can send someone, and it
 * needs no server-side route table (design-spec.md §11).
 */

import { LitElement, css, html, nothing } from 'lit';

import { APP_VERSION, GITHUB_URL, ROOM_CODE_LENGTH } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';

import '../ui/pt-player-chips.js';
import './pt-game.js';
import './pt-landing.js';
import './pt-puzzle-select.js';

/** Reads the current route out of the location hash. */
function parseHash() {
    const path = window.location.hash.replace(/^#\/?/, '');
    if (path.startsWith('room/')) {
        return { name: 'room', code: path.slice('room/'.length).toLowerCase() };
    }
    return { name: 'landing', code: '' };
}

export class PtApp extends LitElement {
    static properties = {
        route: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            max-width: var(--column-width);
            margin: 0 auto;
            padding: var(--space-8) var(--space-4) 0;
            text-align: center;
        }

        h1 {
            margin: 0 0 var(--space-8);
            font-family: var(--font-display);
            font-variation-settings: var(--wordmark-variation);
            font-size: var(--text-wordmark);
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.02em;
        }

        h1 a {
            color: var(--ink);
            text-decoration: none;
        }

        h1 .together {
            color: var(--accent);
        }

        .room-code {
            margin: 0 0 var(--space-6);
            font-size: var(--text-lg);
        }

        .room-code code {
            font-family: var(--font-mono);
            font-size: var(--text-lg);
            letter-spacing: 0.08em;
            color: var(--accent);
        }

        pt-player-chips {
            margin-bottom: var(--space-8);
        }

        .screen {
            margin-bottom: var(--space-12);
        }

        footer {
            padding: var(--space-6) 0;
            border-top: var(--border);
            color: var(--graphite);
            font-size: var(--text-sm);
        }

        footer p {
            margin: 0 0 var(--space-1);
        }

        footer a {
            color: var(--accent-text);
        }

        .notice {
            margin-bottom: var(--space-6);
            color: var(--graphite);
            font-style: italic;
        }

        @media (max-width: 480px) {
            :host {
                padding-top: var(--space-6);
            }

            h1 {
                margin-bottom: var(--space-6);
            }
        }
    `;

    #room = new StoreController(this, roomStore, (state) => [
        state.room,
        state.connection,
        state.error,
    ]);
    #onHashChange = () => this.#applyRoute();

    constructor() {
        super();
        this.route = parseHash();
    }

    /** Starts routing once the element is live. */
    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('hashchange', this.#onHashChange);
        this.#applyRoute();
    }

    /** Stops routing so a detached app cannot keep reacting to navigation. */
    disconnectedCallback() {
        window.removeEventListener('hashchange', this.#onHashChange);
        super.disconnectedCallback();
    }

    /**
     * Applies the current hash: entering a room URL without a live seat attempts a token restore,
     * and falls back to the landing screen when there is no token to restore from.
     */
    #applyRoute() {
        this.route = parseHash();
        if (this.route.name !== 'room') return;
        if (this.route.code.length !== ROOM_CODE_LENGTH) return;

        const state = roomStore.state;
        if (state.code === this.route.code && state.playerId) return;
        roomStore.resume(this.route.code);
    }

    render() {
        return html`
            <h1>
                <a href="#/" aria-label="PuzzleTogether home">
                    Puzzle<span class="together">Together</span>
                </a>
            </h1>
            ${this.#renderRoom()}
            <div class="screen">${this.#renderScreen()}</div>
            <footer>
                <p>PuzzleTogether v${APP_VERSION}</p>
                <p><a href=${GITHUB_URL} rel="noreferrer">View on GitHub</a></p>
            </footer>
        `;
    }

    /** The room code and roster, shown on every screen once a seat is held. */
    #renderRoom() {
        const { room } = this.#room.state;
        if (!room) return nothing;

        return html`
            <p class="room-code">Room <code>${room.code}</code></p>
            <pt-player-chips .players=${room.players} .hostId=${room.hostId}></pt-player-chips>
        `;
    }

    /** The current screen, chosen by route first and room state second. */
    #renderScreen() {
        const state = this.#room.state;

        if (this.route.name !== 'room') {
            return html`<pt-landing></pt-landing>`;
        }

        if (!state.room) {
            // No seat in this room: either the token is being redeemed, or there never was one.
            if (state.connection === 'connecting') {
                return html`<p class="notice">rejoining…</p>`;
            }
            return html`
                ${
                    state.error
                        ? html`<p class="notice" role="alert">${state.error.message}</p>`
                        : nothing
                }
                <pt-landing .prefilledCode=${this.route.code}></pt-landing>
            `;
        }

        return state.room.state === ROOM_STATE.SELECT
            ? html`<pt-puzzle-select></pt-puzzle-select>`
            : html`<pt-game></pt-game>`;
    }
}

customElements.define('pt-app', PtApp);
