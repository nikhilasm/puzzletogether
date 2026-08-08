/**
 * The screen between puzzles: where the host picks what the room plays next.
 *
 * The room returns here after a Back to Puzzle Select and sits here on first join. Non-hosts get
 * the streak and a plain statement that they are waiting — never controls that would be rejected
 * server-side (design-spec.md §4).
 */

import { LitElement, css, html, nothing } from 'lit';

import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { controls } from '../styles/controls.js';
import { iconStyle, leaveIcon } from '../ui/icons.js';

import '../ui/pt-puzzle-picker.js';

export class PtPuzzleSelect extends LitElement {
    static properties = {
        busy: { state: true },
        error: { state: true },
        spec: { state: true },
    };

    static styles = [
        controls,
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

            /*
             * The whole column, not a reading measure. A banked type's card list is the widest thing
             * this screen shows — a title, an author, and a publication on two lines — and the picker
             * keeps its own option rows at 26rem and centred, so the extra width reaches the list and
             * nothing else.
             */
            pt-puzzle-picker {
                max-width: 40rem;
                margin: 0 auto var(--space-6);
            }

            /*
             * Quiet, and set well apart: leaving is not what you came to this screen to do. Spacing
             * rather than a rule, because the footer already draws one a little below it.
             */
            .leave {
                margin-top: var(--space-8);
            }

            .leave button {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
                padding: var(--space-1) var(--space-4);
                font-size: var(--text-sm);
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
            ${roomStore.isHost ? this.#renderHostControls(isSolved) : this.#renderWaiting()}
            ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
            <div class="leave">
                <button type="button" @click=${this.#onLeave}>${leaveIcon} Leave room</button>
            </div>
        `;
    }

    /**
     * Gives up the seat and returns to the landing screen.
     *
     * Navigating is the whole implementation: `<pt-app>` releases the seat whenever the route
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
            <button type="button" ?disabled=${this.busy} @click=${this.#onStart}>
                ${this.busy ? 'finding a puzzle…' : `Start ${isSolved ? 'another' : 'puzzle'}`}
            </button>
        `;
    }

    /** What everyone else sees while the host chooses. */
    #renderWaiting() {
        return html`<p class="waiting">waiting for the host to start a puzzle…</p>`;
    }
}

customElements.define('pt-puzzle-select', PtPuzzleSelect);
