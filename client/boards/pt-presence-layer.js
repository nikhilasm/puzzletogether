/**
 * The presence overlay: one coloured dot per player, in the top-right of the cell they are looking
 * at.
 *
 * A separate layer on purpose. Focus updates arrive at ~10/s per player, and routing them through
 * `<pt-cell>` would re-render the grid constantly (architecture.md §6). It draws only the cells
 * somebody is in, so its cost scales with players, not with grid size.
 */

import { LitElement, css, html, nothing } from 'lit';

import { PLAYER_COLOR_NAMES } from '../../shared/constants.js';

/** How many dots fit in a cell corner before they collapse into a count. */
const MAX_DOTS = 3;

export class PtPresenceLayer extends LitElement {
    static properties = {
        focus: { type: Object },
        players: { type: Array },
        rows: { type: Number },
        cols: { type: Number },
        selfId: { type: String },
    };

    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            display: grid;
            pointer-events: none;
        }

        .cell {
            display: flex;
            gap: 2px;
            align-items: flex-start;
            justify-content: flex-end;
            padding: 3px;
        }

        .dot {
            width: var(--presence-dot);
            height: var(--presence-dot);
            border-radius: var(--radius-round);
            animation: appear var(--motion-presence) ease-in;
        }

        .more {
            font-family: var(--font-ui);
            font-size: var(--text-xs);
            color: var(--graphite);
        }

        @keyframes appear {
            from {
                opacity: 0;
                transform: scale(0.6);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    `;

    constructor() {
        super();
        this.focus = {};
        this.players = [];
        this.rows = 9;
        this.cols = 9;
        this.selfId = null;
    }

    /** Groups the players currently focused on each cell, skipping the local player. */
    #byCell() {
        const grouped = new Map();
        for (const [playerId, cell] of Object.entries(this.focus ?? {})) {
            if (playerId === this.selfId) continue;
            const player = this.players?.find((candidate) => candidate.id === playerId);
            if (!player || !player.connected) continue;
            const group = grouped.get(cell) ?? [];
            group.push(player);
            grouped.set(cell, group);
        }
        return grouped;
    }

    render() {
        const grouped = this.#byCell();
        if (grouped.size === 0) return nothing;

        // Both axes, explicitly. With only the columns declared, every row past the first was an
        // implicit track sized to its dot, so a dot below row 1 landed nowhere near its cell.
        return html`
            <style>
                :host {
                    grid-template-columns: repeat(${this.cols}, 1fr);
                    grid-template-rows: repeat(${this.rows}, 1fr);
                }
            </style>
            ${[...grouped.entries()].map(([cell, players]) => this.#renderCell(cell, players))}
        `;
    }

    /** Draws one cell's dot stack, positioned by grid coordinates rather than pixel maths. */
    #renderCell(cell, players) {
        const row = Math.floor(cell / this.cols) + 1;
        const col = (cell % this.cols) + 1;
        const shown = players.slice(0, MAX_DOTS);
        const overflow = players.length - shown.length;

        return html`
            <div class="cell" style="grid-row: ${row}; grid-column: ${col};">
                ${shown.map(
                    (player) => html`
                        <span
                            class="dot"
                            style="background: var(--player-${player.colorIndex});"
                            title="${player.name}"
                            aria-label="${player.name} (${PLAYER_COLOR_NAMES[player.colorIndex]})"
                        ></span>
                    `,
                )}
                ${overflow > 0 ? html`<span class="more">+${overflow}</span>` : nothing}
            </div>
        `;
    }
}

customElements.define('pt-presence-layer', PtPresenceLayer);
