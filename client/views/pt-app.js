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
import { controls } from '../styles/controls.js';
import { THEME, currentTheme, toggleTheme } from '../theme.js';
import { iconStyle, moonIcon, sunIcon } from '../ui/icons.js';

import '../ui/pt-player-chips.js';
import '../ui/pt-switch.js';
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
        theme: { state: true },
        announcement: { state: true },
    };

    static styles = [
        controls,
        iconStyle,
        css`
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

            footer pt-switch {
                margin-bottom: var(--space-3);
            }

            .notice {
                margin-bottom: var(--space-6);
                color: var(--graphite);
                font-style: italic;
            }

            /* Off-screen but readable: roster changes are announced, never drawn twice. */
            .visually-hidden {
                position: absolute;
                overflow: hidden;
                width: 1px;
                height: 1px;
                clip-path: inset(50%);
                white-space: nowrap;
            }

            @media (max-width: 480px) {
                :host {
                    padding: var(--space-6) var(--space-4) 0;
                }

                h1 {
                    margin-bottom: var(--space-6);
                }

                pt-player-chips {
                    margin-bottom: var(--space-6);
                }

                .screen {
                    margin-bottom: var(--space-8);
                }
            }
        `,
    ];

    #room = new StoreController(this, roomStore, (state) => [
        state.room,
        state.playerId,
        state.connection,
        state.error,
    ]);
    #onHashChange = () => this.#applyRoute();
    #announcedPlayers = [];

    constructor() {
        super();
        this.route = parseHash();
        this.theme = THEME.LIGHT;
        this.announcement = '';
    }

    /** Starts routing once the element is live, and reads back the theme already applied. */
    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('hashchange', this.#onHashChange);
        this.theme = currentTheme();
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
     *
     * Navigating *away* from a room — the browser's back button, mostly — gives up the seat. The
     * alternative is a player sitting on the landing screen while the room still lists them as
     * present, which is the ghost-player bug in a new costume. A reload is not this path: it never
     * fires `hashchange`, so a refresh mid-solve still restores from the token.
     */
    #applyRoute() {
        this.route = parseHash();
        const state = roomStore.state;
        const isSameRoom = this.route.name === 'room' && state.code === this.route.code;

        if (state.room && !isSameRoom) roomStore.leave();
        if (this.route.name !== 'room') return;
        if (this.route.code.length !== ROOM_CODE_LENGTH) return;
        if (isSameRoom && state.playerId) return;

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
            <p class="visually-hidden" role="status" aria-live="polite">${this.announcement}</p>
            <footer>
                <pt-switch
                    label="Dark theme"
                    .checked=${this.theme === THEME.DARK}
                    @pt-switch-change=${this.#onToggleTheme}
                >
                    <span slot="icon">${this.theme === THEME.DARK ? moonIcon : sunIcon}</span>
                </pt-switch>
                <p>PuzzleTogether v${APP_VERSION}</p>
                <p><a href=${GITHUB_URL} rel="noreferrer">View on GitHub</a></p>
            </footer>
        `;
    }

    /** Switches theme and remembers it; the attribute on `<html>` does the rest. */
    #onToggleTheme() {
        this.theme = toggleTheme();
    }

    /**
     * Works out who joined or left since the last update, so the roster is not conveyed by a
     * silent visual change alone (design-spec.md §11).
     *
     * Runs before render rather than inside it, because it is a diff against the previous roster
     * and a render must not depend on how many times it has run.
     */
    willUpdate() {
        const players = this.#room.state.room?.players ?? [];
        const previous = this.#announcedPlayers;
        this.#announcedPlayers = players.map((player) => ({ id: player.id, name: player.name }));

        const joined = this.#announcedPlayers.filter(
            (player) => !previous.some((earlier) => earlier.id === player.id),
        );
        const left = previous.filter(
            (earlier) => !this.#announcedPlayers.some((player) => player.id === earlier.id),
        );
        if (joined.length === 0 && left.length === 0) return;

        const parts = [];
        if (joined.length > 0) parts.push(`${joined.map((p) => p.name).join(', ')} joined`);
        if (left.length > 0) parts.push(`${left.map((p) => p.name).join(', ')} left`);
        this.announcement = parts.join('; ');
    }

    /**
     * The room code and roster, shown on every screen inside a room — and on none outside one, so
     * navigating away cannot leave a roster stranded above the landing form.
     */
    #renderRoom() {
        const { room, playerId } = this.#room.state;
        if (!room || this.route.name !== 'room') return nothing;

        return html`
            <p class="room-code">Room <code>${room.code}</code></p>
            <pt-player-chips
                .players=${room.players}
                .hostId=${room.hostId}
                .selfId=${playerId}
            ></pt-player-chips>
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
