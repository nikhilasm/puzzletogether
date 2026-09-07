/**
 * The screen between puzzles, where the host picks what the room plays next; reached after Back to
 * Puzzle Select and on first join. Non-hosts get the greyed list and a statement that they are
 * waiting, never controls that would be rejected (design-spec.md §4).
 */

import { LitElement, css, html, nothing } from 'lit';

import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { accentButton, controls, dangerButton } from '../styles/controls.js';
import { iconStyle, leaveIcon, startIcon } from '../ui/icons.js';

import '../ui/pt-puzzle-picker.js';

export class PtPuzzleSelect extends LitElement {
    static properties = {
        busy: { state: true },
        error: { state: true },
        spec: { state: true },
    };

    static styles = [
        controls,
        dangerButton,
        accentButton,
        iconStyle,
        css`
            :host {
                display: block;
                text-align: center;
            }

            .streak {
                margin: 0 0 var(--space-6);
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            /* The whole column, not a reading measure, since a banked type's card list is the widest
               thing here and the picker centres its own option rows at 26rem. */
            pt-puzzle-picker {
                max-width: 40rem;
                margin: 0 auto var(--space-6);
            }

            .start {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
            }

            /* Set well apart by spacing since the footer already draws a rule below it, a full-size
               button as on the game screen, saying what it is with the red accent. */
            .leave {
                margin-top: var(--space-8);
            }

            .leave button {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
            }
        `,
    ];

    #store = new StoreController(this, roomStore, (state) => [state.room, state.catalog]);

    constructor() {
        super();
        this.busy = false;
        this.error = null;
        this.spec = null;
    }

    /** The room's last settings are the sensible default: most rooms play the same thing again. */
    get #spec() {
        const settings = this.#store.state.room?.settings ?? DEFAULT_SETTINGS;
        return (
            this.spec ?? {
                type: settings.type,
                difficulty: settings.difficulty,
                size: settings.size,
            }
        );
    }

    /** Asks the server to start a puzzle. Rejected server-side if this client is not the host. */
    async #onStart() {
        this.busy = true;
        this.error = null;
        try {
            await roomStore.startPuzzle(this.#spec);
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
            ${roomStore.isHost ? this.#renderHostControls(isSolved) : this.#renderMemberView()}
            ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
            <div class="leave">
                <button class="danger" type="button" @click=${this.#onLeave}>
                    ${leaveIcon} Leave Room
                </button>
            </div>
        `;
    }

    /**
     * Gives up the seat and returns to the landing screen.
     *
     * Navigating is the whole implementation: <pt-app> releases the seat whenever the route
     * leaves a room, so this button and the browser's back button cannot drift apart.
     */
    #onLeave() {
        window.location.hash = '#/';
    }

    /** The pickers and the start button, for the host only. */
    #renderHostControls(isSolved) {
        return html`
            <pt-puzzle-picker
                .spec=${this.#spec}
                .catalog=${this.#store.state.catalog}
                .disabled=${this.busy}
                @pt-spec-change=${(event) => {
                    this.spec = event.detail.spec;
                }}
            ></pt-puzzle-picker>
            <button
                class="accent start"
                type="button"
                ?disabled=${this.busy}
                @click=${this.#onStart}
            >
                ${startIcon}
                ${this.busy ? 'finding a puzzle…' : `Start ${isSolved ? 'another' : 'puzzle'}`}
            </button>
        `;
    }

    /** What everyone else sees: the puzzles this room can play, and that the host has yet to start. */
    #renderMemberView() {
        return html`
            <pt-puzzle-picker readonly .catalog=${this.#store.state.catalog}></pt-puzzle-picker>
            <p class="waiting">waiting for the host to start a puzzle…</p>
        `;
    }
}

customElements.define('pt-puzzle-select', PtPuzzleSelect);
