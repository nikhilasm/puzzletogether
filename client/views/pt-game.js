/**
 * The game screen: puzzle header, timer, and the shared grid.
 *
 * Owns no state. It reads the store, hands the board what it needs, and turns board events back
 * into store calls — the keypad, mode toggle, and check/reveal controls join it in Phase 2.
 */

import { LitElement, css, html, nothing } from 'lit';

import { ROOM_STATE } from '../../shared/protocol.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { controls } from '../styles/controls.js';

import '../boards/pt-sudoku-board.js';
import '../ui/pt-timer.js';

/** Turns `elapsedMs` into the `m:ss` the solved line shows. */
function formatElapsed(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export class PtGame extends LitElement {
    static styles = [
        controls,
        css`
            :host {
                display: block;
            }

            .header {
                margin: 0 0 var(--space-2);
                font-size: var(--text-xl);
                font-weight: 400;
                text-align: center;
            }

            .header strong {
                font-weight: 700;
            }

            pt-timer {
                margin-bottom: var(--space-4);
            }

            .board {
                max-width: 480px;
                margin: 0 auto;
            }

            .solved {
                margin-top: var(--space-6);
                text-align: center;
            }

            .solved p {
                margin: 0 0 var(--space-2);
                font-size: var(--text-lg);
            }
        `,
    ];

    // Everything this screen passes down to the board, and nothing else — the roster changing does
    // not need to re-render a grid.
    #store = new StoreController(this, roomStore, (state) => [
        state.doc,
        state.view,
        state.focus,
        state.selection,
        state.solved,
        state.room,
    ]);

    /** Moves the local selection, which is also what broadcasts presence. */
    #onSelect(event) {
        roomStore.setSelection(event.detail.cell);
    }

    /** Writes a value optimistically and sends the op. */
    #onInput(event) {
        roomStore.setValue(event.detail.cell, event.detail.value);
    }

    /** Clears a cell. */
    #onClear(event) {
        roomStore.clearCell(event.detail.cell);
    }

    render() {
        const state = this.#store.state;
        const doc = state.doc;
        if (!doc) return nothing;

        const size = `${doc.size.rows}x${doc.size.cols}`;
        const difficulty = doc.difficulty[0].toUpperCase() + doc.difficulty.slice(1);
        const type = doc.type[0].toUpperCase() + doc.type.slice(1);
        const isSolved = state.room?.state === ROOM_STATE.SOLVED;

        return html`
            <h2 class="header"><strong>${type}</strong>: ${difficulty} ${size}</h2>
            <pt-timer
                .startedAt=${state.startedAt}
                .clockOffsetMs=${state.clockOffsetMs}
                .frozenMs=${state.solved?.elapsedMs ?? null}
            ></pt-timer>

            <div
                class="board"
                @pt-cell-select=${this.#onSelect}
                @pt-cell-input=${this.#onInput}
                @pt-cell-clear=${this.#onClear}
            >
                <pt-sudoku-board
                    .doc=${doc}
                    .board=${state.view}
                    .focus=${state.focus}
                    .players=${state.room?.players ?? []}
                    .selfId=${state.playerId}
                    .selection=${state.selection}
                    .interactive=${!isSolved}
                ></pt-sudoku-board>
            </div>

            ${state.solved ? this.#renderSolved(state.solved) : nothing}
        `;
    }

    /**
     * The Phase 1 solve announcement. The full congrats modal, with host new-puzzle controls,
     * lands in Phase 2; the numbers shown are already the server's.
     */
    #renderSolved(solved) {
        return html`
            <div class="solved" role="status">
                <p>Solved in ${formatElapsed(solved.elapsedMs)} — streak ${solved.streak}</p>
            </div>
        `;
    }
}

customElements.define('pt-game', PtGame);
