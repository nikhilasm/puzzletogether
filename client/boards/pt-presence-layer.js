/**
 * The presence overlay: a stripe along the bottom edge of every cell somebody is looking at, split
 * into one segment per player. A stripe occupies an edge rather than the interior, so it never
 * covers a note or value and the room subdivides a fixed footprint; a separate layer since focus
 * updates at ~10/s would otherwise re-render the grid (architecture.md §6).
 */

import { LitElement, css, html, nothing } from 'lit';

import { PLAYER_COLOR_NAMES } from '../../shared/constants.js';

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

        /* The stripe hangs off the bottom edge, inset from the sides, so it belongs to one square;
           the bottom edge is the one part nothing else claims. */
        .cell {
            display: flex;
            align-items: flex-end;
            padding: 0 6%;
        }

        /* Sized by the cell and clamped between 3px and 6px, with a gap that keeps two players'
           colours from merging into one band. */
        .stripe {
            display: flex;
            gap: 1px;
            width: 100%;
            height: clamp(3px, calc(var(--cell-size, 40px) * var(--presence-stripe, 0.09)), 6px);
        }

        /* Every player gets an equal flex share of a fixed width, with min-width: 0 so eight of them
           still shrink to fit on a phone. */
        .who {
            flex: 1 1 0;
            min-width: 0;
            /* Rounded to a capsule so each share reads as a badge rather than a length of rule, one
               of the few places the round radius is right on a square grid (brand.md §4). */
            border-radius: var(--radius-round);
            animation: appear var(--motion-presence) ease-in;
        }

        @keyframes appear {
            from {
                opacity: 0;
                transform: scaleY(0.4);
            }
            to {
                opacity: 1;
                transform: scaleY(1);
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
        // implicit track sized to its contents, so a stripe below row 1 landed nowhere near its cell.
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

    /** One cell's stripe, positioned by grid coordinates rather than pixel maths. */
    #renderCell(cell, players) {
        const row = Math.floor(cell / this.cols) + 1;
        const col = (cell % this.cols) + 1;

        return html`
            <div class="cell" style="grid-row: ${row}; grid-column: ${col};">
                <div class="stripe">
                    ${players.map(
                        (player) => html`
                            <span
                                class="who"
                                style="background: var(--player-${player.colorIndex});"
                                title="${player.name}"
                                aria-label="${player.name} (${
                                    PLAYER_COLOR_NAMES[player.colorIndex]
                                })"
                            ></span>
                        `,
                    )}
                </div>
            </div>
        `;
    }
}

customElements.define('pt-presence-layer', PtPresenceLayer);
