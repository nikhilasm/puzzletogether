/**
 * The solve celebration: one pulse of colour per square, sweeping the grid from its top-left corner
 * to its bottom-right before the congrats modal opens.
 *
 * A separate layer for the same reason presence is one (architecture.md §6). The alternative is a
 * property on `<pt-cell>`, and that is the element whose per-update cost decides whether a 25×25
 * stays smooth — a celebration is not worth a reason for the grid's hot path to grow a branch.
 *
 * It is mounted for the length of the wave and then removed, so **mounting is the trigger**: there
 * is no class to add, remove, and re-add to restart an animation, and nothing left in the DOM
 * afterwards to explain.
 *
 * The colours are the room's, which is the whole point — a puzzle solved together says so in the
 * colours of the people who solved it. It still does not put a player's colour on what they wrote
 * (brand.md §3): this is a wash over the grid's *surface*, the same channel the cursor already uses
 * — and for the length of the wave it is the *only* thing using it, since the cursor's own washes
 * stand down while it runs (see `#renderCell` on `<pt-board>`).
 */

import { LitElement, css, html, nothing } from 'lit';

/**
 * How long the whole celebration takes, for the caller holding the congrats modal back until it is
 * over.
 *
 * The sum of the two motion tokens the stylesheet below reads — the sweep, then the last square's
 * own pulse — restated here because a `setTimeout` cannot read a duration out of a stylesheet.
 * Change one and change the other.
 */
export const CELEBRATION_MS = 1500;

/**
 * Whether this player has asked for less motion, in which case there is no celebration at all.
 *
 * `prefers-reduced-motion` collapses every duration in the app to 0ms (base.css), which is the right
 * answer for an animation and the wrong one for the pause in front of the modal: the wave would
 * vanish and the wait would remain, which is worse than never celebrating. So the decision is made
 * here, in JavaScript, next to the timer that would otherwise hold the modal back.
 */
export function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export class PtCelebrationLayer extends LitElement {
    static properties = {
        /** Which squares take part, decided by the board — see `celebrates` on `<pt-board>`. */
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

        /*
         * One square's moment in the wave.
         *
         * The delay is arithmetic in the stylesheet rather than a number computed per cell in
         * JavaScript, for the same reason --value-len is (see pt-cell): the geometry of the thing
         * belongs with the rest of its geometry. Dividing the sweep by the grid's own span is what
         * makes a 4×4 mini and a 25×25 crossword take the same time end to end — the wave travels
         * faster across a bigger grid instead of the pause in front of the modal growing with it.
         *
         * The backwards fill is what keeps a square invisible during its delay, rather than sitting
         * at the keyframe's starting opacity waiting for its turn.
         */
        .pulse {
            border-radius: var(--radius-grid);
            opacity: 0;
            animation: pulse var(--motion-celebrate-pulse) ease-out backwards;
            animation-delay: calc(
                var(--motion-celebrate-sweep) / var(--wave-span) * var(--diagonal)
            );
        }

        /*
         * Up and out again, not a fade to a resting tint: the grid has to end the way it started or
         * the celebration becomes a state the puzzle is left in. The scale is the same idea as a
         * mark landing (brand.md §5), at the size of a square rather than a glyph.
         */
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
     * Snapshotted rather than read per render because the roster arrives on its own schedule —
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

    /** One `var(--player-N)` per player in the room, in seat order. */
    get #palette() {
        if (this.#colors) return this.#colors;

        const present = (this.players ?? []).filter((player) => player.connected);
        // A room with nobody in it cannot solve a puzzle, so this is unreachable in practice — but a
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
        // one-square grid spans nothing and a `calc()` that divides by zero is simply dropped.
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
     * One wash per participating square, placed by grid coordinates and delayed by its diagonal.
     *
     * `row + col` is constant along an anti-diagonal, so the delay makes a straight front travelling
     * corner to corner — and cycling the palette on the same number is what turns the room's colours
     * into bands chasing each other down the grid rather than a colour per square.
     *
     * A plain loop over what can be 625 squares (code-style.md §7). It runs once per solve, but it
     * runs at the one moment the whole room is looking at the grid.
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
