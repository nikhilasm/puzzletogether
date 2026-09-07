/**
 * The player roster: one chip per player, two per row, host marked with a leading star, a player's
 * colour carried by their name and nothing else (brand.md §3). Your own chip opens the palette to
 * change colour, the host gets a remove control on everyone else's behind a confirm, and colour
 * claims and removals go straight to the store since only the server knows what is free.
 */

import { LitElement, css, html, nothing } from 'lit';

import { PLAYER_COLOR_COUNT, PLAYER_COLOR_NAMES } from '../../shared/constants.js';
import { roomStore } from '../store/room-store.js';
import { focusRing } from '../styles/controls.js';
import '../views/pt-confirm.js';

import { closeIcon, iconStyle } from './icons.js';

export class PtPlayerChips extends LitElement {
    static properties = {
        players: { type: Array },
        hostId: { type: String },
        selfId: { type: String },
        picking: { state: true },
        error: { state: true },
        kicking: { state: true },
    };

    static styles = [
        focusRing,
        iconStyle,
        css`
            /* Shadow roots do not inherit the page's reset, and the chips' widths depend on it:
               without it a bordered, padded chip overflowed its grid track and the local player's
               chip came out wider than everybody else's. */
            *,
            *::before,
            *::after {
                box-sizing: border-box;
            }

            :host {
                display: block;
            }

            /* The palette hangs off this rather than off a chip; see .palette below. */
            .roster {
                position: relative;
            }

            ul {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: var(--space-2);
                margin: 0;
                padding: 0;
                list-style: none;
            }

            /* One rule for every chip, since a button and a span have different font and box defaults
               that made one client's own chip a different size elsewhere. */
            .chip {
                display: flex;
                gap: var(--space-2);
                align-items: center;
                justify-content: center;
                width: 100%;
                min-height: 2.25rem;
                padding: var(--space-1) var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-base);
                line-height: 1.25;
                text-align: center;
            }

            button.chip {
                cursor: pointer;
                touch-action: manipulation;
            }

            @media (hover: hover) {
                button.chip:hover {
                    border-color: var(--accent);
                }
            }

            /* Room for the remove control so a long name cannot run underneath it, with the chip's
               outer size unchanged. */
            li[data-kickable] .chip {
                padding-right: var(--space-8);
            }

            li[data-away] .chip {
                opacity: 0.45;
            }

            .name {
                overflow: hidden;
                color: var(--player-color, var(--ink));
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .you {
                flex: none;
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            .host {
                flex: none;
                color: var(--ink);
            }

            /* Sits on the chip rather than in it, so adding it cannot change the chip's size. */
            .kick {
                position: absolute;
                top: 50%;
                right: var(--space-1);
                display: flex;
                padding: var(--space-1);
                border: none;
                border-radius: var(--radius-control);
                background: transparent;
                color: var(--graphite);
                transform: translateY(-50%);
                cursor: pointer;
                touch-action: manipulation;
            }

            @media (hover: hover) {
                .kick:hover {
                    color: var(--wrong);
                }
            }

            li {
                position: relative;
            }

            /* Anchored to the roster rather than a chip, since centring a fixed-width panel on one
               chip in a two-column grid hangs it off a narrow screen. */
            .palette {
                position: absolute;
                z-index: 2;
                top: calc(100% + var(--space-1));
                right: 0;
                left: 0;
                padding: var(--space-3);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                box-shadow: var(--shadow-modal);
            }

            .swatches {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-2);
                justify-content: center;
            }

            .swatch {
                position: relative;
                overflow: hidden;
                flex: none;
                width: 2rem;
                height: 2rem;
                padding: 0;
                border: var(--border);
                border-radius: var(--radius-control);
                cursor: pointer;
                touch-action: manipulation;
            }

            .swatch[aria-pressed='true'] {
                border-color: var(--ink);
                border-width: 3px;
            }

            /* Taken by somebody else: greyed and struck through rather than hidden, two channels
               since dimming alone is easy to miss on a saturated swatch. */
            .swatch:disabled {
                cursor: default;
            }

            .swatch:disabled::before {
                position: absolute;
                inset: 0;
                background: color-mix(in srgb, var(--graphite) 65%, transparent);
                content: '';
            }

            .swatch:disabled::after {
                position: absolute;
                top: 50%;
                right: -20%;
                left: -20%;
                height: 2px;
                background: var(--paper-raised);
                transform: rotate(-45deg);
                content: '';
            }

            .palette-error {
                margin: var(--space-2) 0 0;
                color: var(--wrong);
                font-size: var(--text-sm);
                text-align: center;
            }
        `,
    ];

    #onDocumentPointerDown = (event) => {
        // A click anywhere else dismisses the palette. composedPath is what makes this work
        // across the shadow boundary; event.target outside would just be <pt-player-chips>.
        if (event.composedPath().includes(this)) return;
        this.#close();
    };

    #onDocumentKeyDown = (event) => {
        if (event.key === 'Escape') this.#close();
    };

    constructor() {
        super();
        this.players = [];
        this.hostId = null;
        this.selfId = null;
        this.picking = false;
        this.error = null;
        this.kicking = null;
    }

    /** Listens for the two ways out of an open palette: Escape, or a click elsewhere. */
    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('pointerdown', this.#onDocumentPointerDown);
        document.addEventListener('keydown', this.#onDocumentKeyDown);
    }

    /** Drops those listeners, so a detached roster cannot keep reacting to the page. */
    disconnectedCallback() {
        document.removeEventListener('pointerdown', this.#onDocumentPointerDown);
        document.removeEventListener('keydown', this.#onDocumentKeyDown);
        super.disconnectedCallback();
    }

    /** Whether the local player holds the host seat, which is what shows the remove controls. */
    get #isHost() {
        return Boolean(this.selfId) && this.selfId === this.hostId;
    }

    /** Closes the palette and forgets any failure it was showing. */
    #close() {
        if (!this.picking && !this.error) return;
        this.picking = false;
        this.error = null;
    }

    /**
     * Claims a colour, closing on success. Stays open on failure with the reason, since the only
     * way to fail is somebody else just claiming it; the roster repaints from the server's
     * broadcast.
     */
    async #choose(colorIndex) {
        try {
            await roomStore.chooseColor(colorIndex);
            this.#close();
        } catch (error) {
            this.error = error.message;
        }
    }

    /** Removes a player once the host has confirmed it. Failure means they had already gone. */
    async #kick(playerId) {
        this.kicking = null;
        try {
            await roomStore.kickPlayer(playerId);
        } catch {
            // The roster is server-owned: whatever happened, the next broadcast is the truth.
        }
    }

    render() {
        if (!this.players?.length) return nothing;
        const self = this.players.find((player) => player.id === this.selfId);

        return html`
            <div class="roster">
                <ul>
                    ${this.players.map((player) => this.#renderChip(player))}
                </ul>
                ${this.picking && self ? this.#renderPalette(self) : nothing}
            </div>
            ${this.#renderKickConfirm()}
        `;
    }

    /** One player chip. Disconnected players dim rather than vanish, for the grace period. */
    #renderChip(player) {
        const isHost = player.id === this.hostId;
        const isSelf = player.id === this.selfId;
        const isKickable = this.#isHost && !isSelf;
        const colorName = PLAYER_COLOR_NAMES[player.colorIndex];
        const status = player.connected ? '' : ', disconnected';
        const label = `${player.name}${isSelf ? ', you' : ''}${isHost ? ', host' : ''} (${colorName})${status}`;

        const body = html`
            ${isHost ? html`<span class="host" aria-hidden="true">★</span>` : nothing}
            <span class="name">${player.name}</span>
            ${isSelf ? html`<span class="you">you</span>` : nothing}
        `;

        // The colour as a property on the chip rather than inline on the name, so anything else the
        // chip grows can reach it without the render method handing it out twice.
        return html`
            <li
                style="--player-color: var(--player-${player.colorIndex});"
                ?data-away=${!player.connected}
                ?data-kickable=${isKickable}
            >
                ${
                    isSelf
                        ? html`<button
                              class="chip"
                              type="button"
                              aria-label="${label}. Change your colour"
                              aria-expanded=${this.picking}
                              @click=${() => {
                                  this.picking = !this.picking;
                                  this.error = null;
                              }}
                          >
                              ${body}
                          </button>`
                        : html`<span class="chip" aria-label=${label}>${body}</span>`
                }
                ${isKickable ? this.#renderKick(player) : nothing}
            </li>
        `;
    }

    /** The host's remove control, one per other player. */
    #renderKick(player) {
        return html`
            <button
                class="kick"
                type="button"
                aria-label="Remove ${player.name} from the room"
                @click=${() => {
                    this.kicking = player;
                }}
            >
                ${closeIcon}
            </button>
        `;
    }

    /** Removing somebody is done to them rather than to yourself, so it is confirmed first. */
    #renderKickConfirm() {
        return html`
            <pt-confirm
                .open=${Boolean(this.kicking)}
                heading="Remove ${this.kicking?.name ?? ''}?"
                body="They lose their seat straight away, and can rejoin with the room code."
                confirmLabel="Remove"
                @pt-confirm-cancel=${() => {
                    this.kicking = null;
                }}
                @pt-confirm-accept=${() => void this.#kick(this.kicking.id)}
            ></pt-confirm>
        `;
    }

    /** The palette, with every colour the room already holds shown but unpickable. */
    #renderPalette(self) {
        const taken = new Set(
            this.players
                .filter((player) => player.id !== self.id)
                .map((player) => player.colorIndex),
        );

        return html`
            <div class="palette" role="group" aria-label="Choose your colour">
                <div class="swatches">
                    ${Array.from({ length: PLAYER_COLOR_COUNT }, (_unused, index) =>
                        this.#renderSwatch(index, self.colorIndex, taken.has(index)),
                    )}
                </div>
                ${
                    this.error
                        ? html`<p class="palette-error" role="alert">${this.error}</p>`
                        : nothing
                }
            </div>
        `;
    }

    /** One colour. The name is in the label, so the choice is never carried by hue alone. */
    #renderSwatch(index, currentIndex, isTaken) {
        const name = PLAYER_COLOR_NAMES[index];
        return html`
            <button
                class="swatch"
                type="button"
                style="background: var(--player-${index});"
                aria-pressed=${index === currentIndex}
                aria-label="${name}${isTaken ? ', taken' : ''}"
                ?disabled=${isTaken}
                @click=${() => void this.#choose(index)}
            ></button>
        `;
    }
}

customElements.define('pt-player-chips', PtPlayerChips);
