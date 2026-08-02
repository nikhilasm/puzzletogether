/**
 * The player roster: one pill per player, two per row, host marked with a star.
 *
 * The only place besides the presence dots where player colour appears — and the name is always
 * beside it, because colour is never the only channel (brand.md §3).
 */

import { LitElement, css, html, nothing } from 'lit';

import { PLAYER_COLOR_NAMES } from '../../shared/constants.js';

export class PtPlayerChips extends LitElement {
    static properties = {
        players: { type: Array },
        hostId: { type: String },
    };

    static styles = css`
        :host {
            display: block;
        }

        h2 {
            margin: 0 0 var(--space-2);
            font-family: var(--font-ui);
            font-size: var(--text-base);
            font-weight: 400;
            color: var(--graphite);
            text-align: center;
        }

        ul {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--space-2);
            max-width: 420px;
            margin: 0 auto;
            padding: 0;
            list-style: none;
        }

        li {
            display: flex;
            gap: var(--space-2);
            align-items: center;
            justify-content: center;
            padding: var(--space-1) var(--space-3);
            border: var(--border);
            border-radius: var(--radius-pill);
            font-size: var(--text-base);
        }

        li[data-away] {
            opacity: 0.45;
        }

        .name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .host {
            color: var(--ink);
        }
    `;

    constructor() {
        super();
        this.players = [];
        this.hostId = null;
    }

    render() {
        if (!this.players?.length) return nothing;

        return html`
            <h2>Players</h2>
            <ul>
                ${this.players.map((player) => this.#renderChip(player))}
            </ul>
        `;
    }

    /** One player pill. Disconnected players dim rather than vanish, for the grace period. */
    #renderChip(player) {
        const isHost = player.id === this.hostId;
        const colorName = PLAYER_COLOR_NAMES[player.colorIndex];
        const status = player.connected ? '' : ', disconnected';

        return html`
            <li
                ?data-away=${!player.connected}
                aria-label="${player.name}${isHost ? ', host' : ''} (${colorName})${status}"
            >
                <span class="name" style="color: var(--player-${player.colorIndex});">
                    ${player.name}
                </span>
                ${isHost ? html`<span class="host" aria-hidden="true">★</span>` : nothing}
            </li>
        `;
    }
}

customElements.define('pt-player-chips', PtPlayerChips);
