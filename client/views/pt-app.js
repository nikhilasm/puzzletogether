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

            /*
             * The room's own facts, boxed together: which room this is, how full it is, and who is
             * in it. They were three things stacked down the middle of the page with nothing saying
             * they belonged to each other, and the roster in particular read as a second screen
             * above the real one.
             *
             * Subtle on purpose: a rule and nothing else. It takes the page's own background rather
             * than the raised paper: a filled box reads as a card to be dealt with, and this is a
             * caption on the room. The puzzle under it is what the page is about, and it sits close
             * enough underneath to be read as the next thing rather than the next screen.
             */
            .room-panel {
                max-width: 420px;
                margin: 0 auto var(--space-4);
                padding: var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
            }

            /*
             * Code at one end, seats at the other, on the line above the roster.
             *
             * Centred rather than aligned on their baselines: the two are set several steps apart on
             * the type scale, and a shared baseline hung the smaller of them off the bottom of the
             * line. Nothing here is prose, so there is no baseline to keep.
             */
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

            /*
             * The seat count, unlabelled.
             *
             * It sits at the top of the roster it counts, so a word saying so would be saying it
             * twice, and "2/8" is not ambiguous in a box whose other half is a room code.
             * Screen readers get the sentence the sighted reading gets from the layout.
             */
            .count {
                color: var(--graphite);
                font-size: var(--text-sm);
                font-variant-numeric: tabular-nums;
            }

            .screen {
                margin-bottom: var(--space-12);
            }

            /*
             * The app's own controls, and the three ways out of it, on one bar.
             *
             * Everything above the footer belongs to a room or a puzzle. What is left down here is
             * the handful of things that are true of the *app*: how it looks, what it is, what it
             * has been, where it came from, where to say it is broken, and who made it.
             *
             * The version line that used to be here has moved into About, where it sits with the
             * rest of the answer to the question it was half of.
             */
            footer {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: var(--space-6) 0;
                border-top: var(--border);
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            /*
             * One panel across the column, not a row of separate buttons (ADR-0023).
             *
             * The controls in it are peripheral and unrelated to each other; six outlined boxes
             * side by side read as six decisions of the same weight as the puzzle's own actions.
             * Drawn as divisions of one surface they read as what they are: the strip the app keeps
             * its own switches on.
             *
             * Capped at 22rem, the width the footer's bar has always taken, rather than left to the
             * column. Across the full 640px these are six small drawings adrift in a wide empty
             * rule, which makes the quietest thing on the page the widest.
             *
             * No padding of its own: the controls run edge to edge and their own 2.75rem is the
             * whole of the panel's height. A ring of padding around a strip of icons is 8px of
             * nothing, and this bar is a footnote to the page rather than a surface holding
             * anything.
             */
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

            /*
             * A division of the panel rather than a button on it: no border, no ground, and no
             * radius until it is pressed. The panel is the box; drawing a second one inside it is
             * what made the old footer read as a row of separate controls.
             */
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

            /*
             * A fixed 1.25rem, for the reason .action's icons are a fixed 1rem: nothing in a strip
             * of controls wants to scale with whatever type size it inherits. Larger than the
             * panel's, because here the drawing is the whole of the control and there is no word
             * under it to be read instead.
             */
            .tool .icon {
                width: 1.25rem;
                height: 1.25rem;
            }

            @media (hover: hover) {
                .tool:hover {
                    color: var(--ink);
                }
            }

            /*
             * What answers a tap, since a touch browser has no hover to give and the tooltip stands
             * down there too. Mixed into --paper-raised, never into transparent: the page's texture
             * is drawn behind everything, and a control is a surface laid on the page rather than a
             * window onto it (brand.md §4).
             */
            .tool:active {
                background: color-mix(in srgb, var(--ink) 10%, var(--paper-raised));
                color: var(--ink);
            }

            .notice {
                margin-bottom: var(--space-6);
                color: var(--graphite);
                font-style: italic;
            }

            /*
             * Room at the very foot of the page for the game screen's pinned input panel.
             *
             * It belongs here rather than inside the game screen because the panel is fixed to the
             * viewport and covers *everything* the page ends with, and the page does not end with
             * the game screen: it ends with the footer and the theme switch in it. A spacer inside
             * the game screen reserved room above the footer and left the switch underneath the
             * keys, unclickable at every scroll position.
             *
             * The height is the panel's own measurement, arriving as an event from two shadow roots
             * down; 0 whenever no panel is on screen, which is every screen but the game.
             */
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
     * Applies the current hash: entering a room URL without a live seat attempts a token restore,
     * and falls back to the landing screen when there is no token to restore from.
     *
     * Navigating *away* from a room, most often with the browser's back button, gives up the seat. The
     * alternative is a player sitting on the landing screen while the room still lists them as
     * present, which is the ghost-player bug in a new costume. A reload is not this path: it never
     * fires hashchange, so a refresh mid-solve still restores from the token.
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
                      An action, not a toggle. "Dark theme, pressed" was a state to be read; this is
                      a button that does one thing, so it says which thing and wears the icon of the
                      theme it would leave you in. That also settles which of the two icons to draw,
                      which as a toggle was genuinely ambiguous: the sun could as easily have meant
                      "you are in light" as "press for light", and it meant the first. The tooltip
                      is the destination for the same reason the icon is.
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
     * Leaves the ended room's URL behind, once the player has read why they are out of it.
     *
     * The route is what would otherwise keep offering to rejoin: the hash still names a room whose
     * seat is gone, and for a room that was collected there is nothing there to rejoin. This is
     * where Leave Room lands too, which is the point: however a seat ends, it ends in one place.
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
     * Whether a panel is on screen at all, which is to say whether the game screen is.
     *
     * Asked rather than remembered, because a panel that leaves takes its last measurement with it:
     * it is removed from the page before it could report a height of zero, and an element already
     * detached cannot dispatch anything that would reach here. Without this, going back to Puzzle
     * Select left a keypad's worth of empty page under the footer.
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
     * The room panel (code, seat count, roster), shown on every screen inside a room and on none
     * outside one, so navigating away cannot leave a roster stranded above the landing form.
     *
     * The count is drawn here rather than by <pt-player-chips>, where it used to live as a
     * heading. It is a fact about the *room* (how many seats are taken of how many there are), it
     * belongs on the same line as the room code, and the roster below it is now free to be nothing
     * but the roster.
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
