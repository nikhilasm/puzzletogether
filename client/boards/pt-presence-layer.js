/**
 * The presence overlay: a stripe along the bottom edge of every cell somebody is looking at, split
 * into one segment per player.
 *
 * It was a row of dots in the cell's top-right corner through Phase 4, and both of that design's
 * problems were the same problem — presence was drawn *in* the cell's content area, at a size that
 * grew with the room. The dots covered the top-right pencil mark, and a fourth player had nowhere
 * left to go, so the layer capped at three and wrote `+n` for the rest.
 *
 * A stripe fixes both by construction. It occupies an edge rather than the interior, so it can
 * never sit on a note or a value; and the room subdivides a footprint that does not change, so
 * eight players make eight thin bands instead of eight dots' worth of cell. Reading "how many
 * people are here" off the number of colours is also faster than counting dots, which is what the
 * `+n` was quietly admitting.
 *
 * A separate layer on purpose. Focus updates arrive at ~10/s per player, and routing them through
 * `<pt-cell>` would re-render the grid constantly (architecture.md §6). It draws only the cells
 * somebody is in, so its cost scales with players, not with grid size.
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

        /*
         * The stripe hangs off the bottom of the cell and is inset from its sides, so it reads as
         * belonging to one square rather than as a rule running between two. The bottom edge is the
         * one part of a cell nothing else claims: the label is top-left, and the mark grid's own 6%
         * padding keeps the last row of notes clear of it.
         */
        .cell {
            display: flex;
            align-items: flex-end;
            padding: 0 6%;
        }

        /*
         * Sized by the cell, like everything else in the grid, and clamped at both ends: 3px is the
         * least that reads as a colour rather than as a hairline on a 25×25, and past 6px a mini's
         * 90px squares would be wearing a bar instead of a stripe.
         *
         * The gap is what keeps two players' colours from merging into one band. It shows whatever
         * is under the layer, so it costs nothing on a nonogram's filled square.
         */
        .stripe {
            display: flex;
            gap: 1px;
            width: 100%;
            height: clamp(3px, calc(var(--cell-size, 40px) * var(--presence-stripe, 0.09)), 6px);
        }

        /*
         * Every player gets the same share of the stripe, however many there are — an equal flex of
         * a fixed width, which is the whole reason this scales where a row of dots did not. The
         * zero min-width is because a flex item will not otherwise shrink below its content, and
         * eight of them on a phone are asking to.
         */
        .who {
            flex: 1 1 0;
            min-width: 0;
            /*
             * Rounded, which at this height is a capsule — --radius-round clamps to half the
             * shorter side. Each player's share reads as a thing rather than as a length of rule,
             * and a lone player in a cell gets a mark instead of a dash. This is one of the few
             * places the round radius is right on a square grid (brand.md §4): the stripe is a
             * badge sitting on the cell, not part of its ruling.
             */
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
