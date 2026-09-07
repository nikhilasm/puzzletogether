/**
 * The solve celebration: one pulse of colour per square, sweeping the grid corner to corner before
 * the congrats modal opens. A separate layer rather than a property on pt-cell, whose per-update
 * cost is the grid's hot path; mounting is the trigger, and the colours are the room's, washing the
 * surface the cursor uses rather than the values (brand.md §3, architecture.md §6).
 */

import { LitElement, css, html, nothing } from 'lit';

/**
 * How long the whole celebration takes, for the caller holding the congrats modal back until it is
 * over. The sum of the two motion tokens the stylesheet reads, restated here since a setTimeout
 * cannot read a stylesheet, so change one and change the other.
 */
export const CELEBRATION_MS = 1500;

/**
 * Whether this player has asked for less motion, in which case there is no celebration at all.
 * Decided here in JavaScript because the CSS collapse to 0ms would leave the wave gone but the
 * pause in front of the modal remaining.
 */
export function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export class PtCelebrationLayer extends LitElement {
    static properties = {
        /** Which squares take part, decided by the board; see celebrates on <pt-board>. */
        cells: { type: Array },
        players: { type: Array },
        rows: { type: Number },
        cols: { type: Number },
    };

    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            display: grid;
            pointer-events: none;
        }

        /* One square's moment in the wave; the delay divides the sweep by the grid's span so every
           size takes the same time end to end, and the backwards fill keeps a square invisible
           until its turn. */
        .pulse {
            border-radius: var(--radius-grid);
            opacity: 0;
            animation: pulse var(--motion-celebrate-pulse) ease-out backwards;
            animation-delay: calc(
                var(--motion-celebrate-sweep) / var(--wave-span) * var(--diagonal)
            );
        }

        /* Up and out again, not a fade to a resting tint, so the grid ends the way it started
           (brand.md §5). */
        @keyframes pulse {
            from {
                opacity: 0;
                transform: scale(0.92);
            }
            50% {
                opacity: 0.32;
                transform: scale(1);
            }
            to {
                opacity: 0;
                transform: scale(1);
            }
        }
    `;

    /**
     * The room's colours as they stood when the wave began.
     *
     * Snapshotted rather than read per render because the roster arrives on its own schedule:
     * somebody joining, leaving, or being renamed halfway down the grid must not recolour a sweep
     * that is already running.
     */
    #colors = null;

    constructor() {
        super();
        this.cells = [];
        this.players = [];
        this.rows = 9;
        this.cols = 9;
    }

    /** One var(--player-N) per player in the room, in seat order. */
    get #palette() {
        if (this.#colors) return this.#colors;

        const present = (this.players ?? []).filter((player) => player.connected);
        // A room with nobody in it cannot solve a puzzle, so this is unreachable in practice, but a
        // celebration that renders nothing is a worse answer than one drawn in the app's accent.
        this.#colors =
            present.length > 0
                ? present.map((player) => `var(--player-${player.colorIndex})`)
                : ['var(--accent)'];
        return this.#colors;
    }

    render() {
        const cells = this.cells ?? [];
        if (cells.length === 0) return nothing;

        // Both axes explicitly, and the span the delays divide by. Held to at least 1, because a
        // one-square grid spans nothing and a calc() that divides by zero is simply dropped.
        return html`
            <style>
                :host {
                    grid-template-columns: repeat(${this.cols}, 1fr);
                    grid-template-rows: repeat(${this.rows}, 1fr);
                    --wave-span: ${Math.max(1, this.rows + this.cols - 2)};
                }
            </style>
            ${this.#renderPulses(cells)}
        `;
    }

    /**
     * One wash per participating square, placed by grid coordinates and delayed by its diagonal, so
     * row + col makes a straight front corner to corner with the palette cycling into bands. A plain
     * loop over up to 625 squares (code-style.md §7), run once per solve.
     */
    #renderPulses(cells) {
        const palette = this.#palette;
        const pulses = [];

        for (const cell of cells) {
            const row = Math.floor(cell / this.cols);
            const col = cell % this.cols;
            const diagonal = row + col;
            const color = palette[diagonal % palette.length];

            pulses.push(
                html`<span
                    class="pulse"
                    style="grid-row: ${row + 1}; grid-column: ${
                        col + 1
                    }; --diagonal: ${diagonal}; background: ${color};"
                ></span>`,
            );
        }

        return pulses;
    }
}

customElements.define('pt-celebration-layer', PtCelebrationLayer);
