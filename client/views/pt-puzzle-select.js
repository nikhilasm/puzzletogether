/**
 * The waiting screen between puzzles.
 *
 * Phase 1 stub: the host gets one button that starts a sudoku with the room's default settings.
 * Phase 2 replaces the button with the real type / difficulty / size pickers — the `game:start`
 * event it emits is already the final one, so nothing below this view changes then.
 */

import { LitElement, css, html, nothing } from 'lit';

import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { controls } from '../styles/controls.js';

export class PtPuzzleSelect extends LitElement {
    static properties = {
        busy: { state: true },
        error: { state: true },
    };

    static styles = [
        controls,
        css`
            :host {
                display: block;
                text-align: center;
            }

            .streak {
                margin-bottom: var(--space-4);
                color: var(--graphite);
                font-size: var(--text-sm);
            }
        `,
    ];

    #store = new StoreController(this, roomStore, (state) => state.room);

    constructor() {
        super();
        this.busy = false;
        this.error = null;
    }

    /** Asks the server to start a puzzle. Rejected server-side if this client is not the host. */
    async #onStart() {
        this.busy = true;
        this.error = null;
        try {
            await roomStore.startPuzzle({
                type: DEFAULT_SETTINGS.type,
                difficulty: DEFAULT_SETTINGS.difficulty,
                size: DEFAULT_SETTINGS.size,
            });
        } catch (error) {
            this.error = error.message;
        } finally {
            this.busy = false;
        }
    }

    render() {
        const { room } = this.#store.state;
        const isSolved = room?.state === ROOM_STATE.SOLVED;

        return html`
            ${room?.streak ? html`<p class="streak">Solve streak: ${room.streak}</p>` : nothing}
            ${
                roomStore.isHost
                    ? html`
                          <button ?disabled=${this.busy} @click=${this.#onStart}>
                              ${this.busy ? 'finding a puzzle…' : `Start ${isSolved ? 'another ' : ''}Sudoku`}
                          </button>
                      `
                    : html`<p class="waiting">waiting for the host to start a puzzle…</p>`
            }
            ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        `;
    }
}

customElements.define('pt-puzzle-select', PtPuzzleSelect);
