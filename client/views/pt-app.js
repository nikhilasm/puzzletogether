/**
 * Root element and router: the wordmark, the room header, the current screen, and the footer.
 *
 * The router is a hash router by design: #/room/kqjy is a link you can send someone, and it
 * needs no server-side route table (design-spec.md §11).
 */

import { LitElement, css, html, nothing } from 'lit';

import {
    GITHUB_URL,
    HOMEPAGE_URL,
    ISSUES_URL,
    MAX_PLAYERS_PER_ROOM,
    ROOM_CODE_LENGTH,
} from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { controls } from '../styles/controls.js';
import { THEME, currentTheme, toggleTheme } from '../theme.js';
import {
    changelogIcon,
    flagIcon,
    githubIcon,
    homeIcon,
    iconStyle,
    infoIcon,
    moonIcon,
    sunIcon,
} from '../ui/icons.js';

import '../ui/pt-player-chips.js';
import '../ui/pt-tooltip.js';
import './pt-about.js';
import './pt-changelog.js';
import './pt-game.js';
import './pt-landing.js';
import './pt-puzzle-select.js';
import './pt-seat-ended.js';

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
        /** How tall the game screen's pinned input panel is, or 0 when there is none. */
        panelHeight: { state: true },
        showingAbout: { state: true },
        showingChangelog: { state: true },
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

            /* The room's own facts (code, seat count, roster) boxed together with a rule and the
               page's own background, so it reads as a caption on the room rather than a second
               screen. */
            .room-panel {
                max-width: 420px;
                margin: 0 auto var(--space-4);
                padding: var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
            }

            /* Code at one end, seats at the other, centred rather than baseline-aligned since the
               two are several steps apart on the type scale. */
            .room-head {
                display: flex;
                gap: var(--space-3);
                align-items: center;
                justify-content: space-between;
                margin-bottom: var(--space-3);
            }

            .room-code {
                margin: 0;
                font-size: var(--text-lg);
            }

            .room-code code {
                font-family: var(--font-mono);
                font-size: var(--text-lg);
                letter-spacing: 0.08em;
                color: var(--accent);
            }

            /* The seat count, unlabelled since it sits atop the roster it counts and screen readers
               get the sentence from the aria-label. */
            .count {
                color: var(--graphite);
                font-size: var(--text-sm);
                font-variant-numeric: tabular-nums;
            }

            .screen {
                margin-bottom: var(--space-12);
            }

            /* The app's own controls and the ways out of it, the handful of things true of the app
               rather than of a room or puzzle. */
            footer {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: var(--space-6) 0;
                border-top: var(--border);
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            /* One panel across the column rather than a row of separate buttons (ADR-0023), capped
               at 22rem and with no padding of its own, so the peripheral controls read as divisions
               of one surface rather than decisions of the puzzle's weight. */
            .toolbar {
                display: flex;
                width: 100%;
                max-width: 22rem;
                padding: 0;
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
            }

            /* The wrappers are the flex items, so the bar divides itself between however many
               controls it holds and each button fills the wrapper it is in. */
            .toolbar pt-tooltip {
                flex: 1 1 0;
                min-width: 0;
            }

            /* A division of the panel rather than a button on it: no border, ground, or radius until
               pressed, since the panel is the box. */
            .tool {
                display: flex;
                flex: 1 1 auto;
                align-items: center;
                justify-content: center;
                min-height: 2.75rem;
                padding: 0;
                border: none;
                border-radius: var(--radius-control);
                background: none;
                color: var(--graphite);
                text-decoration: none;
                cursor: pointer;
                touch-action: manipulation;
                /* The platform's tap flash is off wherever this file draws an :active of its own;
                   see the same rule on .action in controls.js. */
                -webkit-tap-highlight-color: transparent;
            }

            /* A fixed 1.25rem (see .action) since a strip of controls should not scale with
               inherited type, larger than the panel's because the drawing is the whole control
               here. */
            .tool .icon {
                width: 1.25rem;
                height: 1.25rem;
            }

            @media (hover: hover) {
                .tool:hover {
                    color: var(--ink);
                }
            }

            /* What answers a tap where a touch browser has no hover, mixed into --paper-raised so the
               page texture does not show through (brand.md §4). */
            .tool:active {
                background: color-mix(in srgb, var(--ink) 10%, var(--paper-raised));
                color: var(--ink);
            }

            .notice {
                margin-bottom: var(--space-6);
                color: var(--graphite);
                font-style: italic;
            }

            /* Room at the foot of the page for the game screen's pinned panel, reserved here rather
               than in the game screen since the fixed panel covers the footer the page actually ends
               with. */
            .panel-space {
                flex: none;
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

                .room-panel {
                    margin-bottom: var(--space-3);
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
        state.ended,
    ]);
    #onHashChange = () => this.#applyRoute();
    #announcedPlayers = [];

    constructor() {
        super();
        this.route = parseHash();
        this.theme = THEME.LIGHT;
        this.announcement = '';
        this.panelHeight = 0;
        this.showingAbout = false;
        this.showingChangelog = false;
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
     * Applies the current hash: a room URL without a live seat attempts a token restore, falling
     * back to the landing screen. Navigating away from a room gives up the seat, or the room would
     * still list the player as present; a reload never fires hashchange, so it still restores from
     * the token.
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
            <div class="screen" @pt-keypad-resize=${this.#onPanelResize}>
                ${this.#renderScreen()}
            </div>
            <p class="visually-hidden" role="status" aria-live="polite">${this.announcement}</p>
            <footer>
                <div class="toolbar">
                    <!--
                      An action, not a toggle: the button wears the icon of the theme it would leave
                      you in and says so, which also settles which of the two icons to draw. The
                      tooltip is the destination for the same reason.
                    -->
                    <pt-tooltip .text=${this.#themeDestination}>
                        <button
                            class="tool"
                            type="button"
                            aria-label=${this.#themeAction}
                            @click=${this.#onToggleTheme}
                        >
                            ${this.theme === THEME.DARK ? sunIcon : moonIcon}
                        </button>
                    </pt-tooltip>
                    <pt-tooltip text="About">
                        <button
                            class="tool"
                            type="button"
                            aria-label="About PuzzleTogether"
                            @click=${() => {
                                this.showingAbout = true;
                            }}
                        >
                            ${infoIcon}
                        </button>
                    </pt-tooltip>
                    <pt-tooltip text="Changelog">
                        <button
                            class="tool"
                            type="button"
                            aria-label="What has changed"
                            @click=${() => {
                                this.showingChangelog = true;
                            }}
                        >
                            ${changelogIcon}
                        </button>
                    </pt-tooltip>
                    <!-- The three that leave the app are anchors, so a middle click still opens
                         them in a tab. Each carries the sentence its one-word tooltip abbreviates. -->
                    <pt-tooltip text="GitHub">
                        <a
                            class="tool"
                            href=${GITHUB_URL}
                            rel="noreferrer"
                            target="_blank"
                            aria-label="PuzzleTogether on GitHub"
                        >
                            ${githubIcon}
                        </a>
                    </pt-tooltip>
                    <pt-tooltip text="Report issue">
                        <a
                            class="tool"
                            href=${ISSUES_URL}
                            rel="noreferrer"
                            target="_blank"
                            aria-label="Report an issue"
                        >
                            ${flagIcon}
                        </a>
                    </pt-tooltip>
                    <pt-tooltip text="Homepage">
                        <a
                            class="tool"
                            href=${HOMEPAGE_URL}
                            rel="noreferrer"
                            target="_blank"
                            aria-label="The author's homepage"
                        >
                            ${homeIcon}
                        </a>
                    </pt-tooltip>
                </div>
            </footer>
            <pt-about
                .open=${this.showingAbout}
                @pt-about-close=${() => {
                    this.showingAbout = false;
                }}
            ></pt-about>
            <pt-changelog
                .open=${this.showingChangelog}
                @pt-changelog-close=${() => {
                    this.showingChangelog = false;
                }}
            ></pt-changelog>
            <!--
              Held here rather than on a screen, because the screen it belongs to is the one that
              has just gone: the store drops the room the moment a seat ends, so whatever was
              rendering the grid is already unmounted by the time this opens.
            -->
            <pt-seat-ended
                .reason=${this.#room.state.ended}
                @pt-seat-ended-close=${this.#onSeatEndedClose}
            ></pt-seat-ended>
            <div
                class="panel-space"
                style="height: ${this.#showsPanel ? this.panelHeight : 0}px"
                aria-hidden="true"
            ></div>
        `;
    }

    /**
     * Leaves the ended room's URL behind, once the player has read why they are out of it, or the
     * hash would keep offering to rejoin a room whose seat is gone. This is where Leave Room lands
     * too: however a seat ends, it ends in one place.
     */
    #onSeatEndedClose() {
        window.location.hash = '#/';
        roomStore.dismissEnded();
    }

    /**
     * Reserves as much of the page's foot as the input panel is covering.
     *
     * The panel measures itself and says so; nothing here knows what a keypad is, only that some
     * screen has pinned something over the bottom of the page.
     */
    #onPanelResize(event) {
        this.panelHeight = event.detail.height;
    }

    /**
     * Whether a panel is on screen at all, which is to say whether the game screen is. Asked rather
     * than remembered, since a panel that leaves is removed before it can report a height of zero.
     */
    get #showsPanel() {
        const room = this.#room.state.room;
        return this.route.name === 'room' && room != null && room.state !== ROOM_STATE.SELECT;
    }

    /** What the theme button would do, which is its whole name. */
    get #themeAction() {
        return this.theme === THEME.DARK ? 'Switch to light theme' : 'Switch to dark theme';
    }

    /** The theme the button would leave you in, which is what its tooltip says and its icon draws. */
    get #themeDestination() {
        return this.theme === THEME.DARK ? 'Light theme' : 'Dark theme';
    }

    /** Switches theme and remembers it; the attribute on <html> does the rest. */
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
     * The room panel (code, seat count, roster), shown on every screen inside a room and none
     * outside, so navigating away cannot strand a roster above the landing form. The count is drawn
     * here rather than by pt-player-chips, since it is a fact about the room and belongs beside the
     * code.
     */
    #renderRoom() {
        const { room, playerId } = this.#room.state;
        if (!room || this.route.name !== 'room') return nothing;

        return html`
            <div class="room-panel">
                <div class="room-head">
                    <p class="room-code">Room <code>${room.code}</code></p>
                    <span
                        class="count"
                        aria-label="${room.players.length} of ${MAX_PLAYERS_PER_ROOM} players"
                    >
                        ${room.players.length}/${MAX_PLAYERS_PER_ROOM}
                    </span>
                </div>
                <pt-player-chips
                    .players=${room.players}
                    .hostId=${room.hostId}
                    .selfId=${playerId}
                ></pt-player-chips>
            </div>
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
