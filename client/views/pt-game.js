/**
 * The game screen: puzzle header, timer, the shared grid, and every control that acts on it.
 *
 * Owns no board state. It reads the store, hands the board and keypad what they need, and turns
 * their events back into store calls — which is what keeps physical keyboard, on-screen keypad, and
 * touch on one input path (design-spec.md §11). The only local state is which dialog is open.
 */

import { LitElement, css, html, nothing } from 'lit';

import { ROOM_STATE } from '../../shared/protocol.js';
import { effectiveValue, isEditable } from '../../shared/puzzle-doc.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { controls } from '../styles/controls.js';
import { iconStyle, leaveIcon } from '../ui/icons.js';

import './pt-confirm.js';
import './pt-congrats-modal.js';
import '../boards/pt-sudoku-board.js';
import '../ui/pt-keypad.js';
import '../ui/pt-mode-toggle.js';
import '../ui/pt-timer.js';

/** How many of each value the grid already holds, so the keypad can dim what is used up. */
function digitCounts(doc, board) {
    const counts = {};
    for (let idx = 0; idx < doc.cells.length; idx += 1) {
        const value = effectiveValue(doc, board, idx);
        if (value != null) counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
}

export class PtGame extends LitElement {
    static properties = {
        confirmingReveal: { state: true },
        busy: { state: true },
    };

    static styles = [
        controls,
        iconStyle,
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
                margin: 0 auto var(--space-6);
            }

            /* The Notes switch sits directly above the digits it changes the meaning of. */
            .mode-bar {
                display: flex;
                justify-content: center;
                max-width: 480px;
                margin: 0 auto var(--space-3);
            }

            pt-keypad {
                max-width: 480px;
                margin: 0 auto var(--space-6);
            }

            .controls {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                align-items: center;
            }

            .assist-buttons {
                display: flex;
                gap: var(--space-3);
                justify-content: center;
            }

            .assists {
                margin: 0;
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            .notice {
                min-height: 1.5rem;
                margin: 0;
                color: var(--graphite);
                font-size: var(--text-sm);
                font-style: italic;
            }

            .back {
                margin-top: var(--space-2);
            }

            /* Same control, same place in the reading order, on both screens. */
            .leave {
                margin-top: var(--space-6);
            }

            .leave button {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
                padding: var(--space-1) var(--space-4);
                font-size: var(--text-sm);
            }

            @media (max-width: 480px) {
                .board,
                pt-keypad {
                    margin-bottom: var(--space-4);
                }

                .controls {
                    gap: var(--space-3);
                }
            }
        `,
    ];

    // Everything this screen passes down, and nothing else — the roster changing does not need to
    // re-render a grid.
    #store = new StoreController(this, roomStore, (state) => [
        state.doc,
        state.view,
        state.focus,
        state.selection,
        state.solved,
        state.room,
        state.inputMode,
        state.checkResults,
        state.assists,
        state.notice,
        state.canUndo,
    ]);

    constructor() {
        super();
        this.confirmingReveal = false;
        this.busy = false;
    }

    /** Moves the local selection, which is also what broadcasts presence. */
    #onSelect(event) {
        roomStore.setSelection(event.detail.cell);
    }

    /** A digit from the grid's own keyboard handling. */
    #onCellInput(event) {
        roomStore.inputDigit(event.detail.cell, event.detail.value);
    }

    /** Backspace or Delete on the grid. */
    #onCellClear(event) {
        roomStore.clearCell(event.detail.cell);
    }

    /**
     * The cell a keypad press should act on: whatever is selected, provided it takes input.
     * Returns null and says why rather than swallowing the press, which on a phone would just look
     * broken.
     */
    #targetCell() {
        const { doc, selection } = this.#store.state;
        if (!doc) return null;

        if (selection == null) {
            roomStore.notify('pick a square first');
            return null;
        }
        if (!isEditable(doc, selection)) {
            roomStore.notify('that square is part of the puzzle');
            return null;
        }
        return selection;
    }

    /** A digit from the on-screen keypad, routed through the same store method as the keyboard. */
    #onKeypadDigit(event) {
        const cell = this.#targetCell();
        if (cell == null) return;
        roomStore.inputDigit(cell, event.detail.value);
    }

    /** Erase from the on-screen keypad. */
    #onKeypadErase() {
        const cell = this.#targetCell();
        if (cell == null) return;
        roomStore.clearCell(cell);
    }

    /** Runs a store action that can fail, holding the controls disabled while it is in flight. */
    async #run(action) {
        this.busy = true;
        try {
            await action();
        } finally {
            this.busy = false;
        }
    }

    /** Starts the puzzle the host chose in the congrats modal. */
    #onStartAnother(event) {
        void this.#run(async () => {
            try {
                await roomStore.startPuzzle(event.detail.spec);
            } catch {
                // The store surfaces the reason; there is nothing useful to do here but stop.
            }
        });
    }

    render() {
        const state = this.#store.state;
        const doc = state.doc;
        if (!doc) return nothing;

        const size = `${doc.size.rows}x${doc.size.cols}`;
        const difficulty = doc.difficulty[0].toUpperCase() + doc.difficulty.slice(1);
        const type = doc.type[0].toUpperCase() + doc.type.slice(1);
        const isPlaying = state.room?.state === ROOM_STATE.PLAYING;

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
                @pt-cell-input=${this.#onCellInput}
                @pt-cell-clear=${this.#onCellClear}
                @pt-undo=${() => roomStore.undo()}
            >
                <pt-sudoku-board
                    .doc=${doc}
                    .board=${state.view}
                    .focus=${state.focus}
                    .players=${state.room?.players ?? []}
                    .selfId=${state.playerId}
                    .selection=${state.selection}
                    .checkResults=${state.checkResults}
                    .interactive=${isPlaying}
                ></pt-sudoku-board>
            </div>

            ${this.#renderKeypad(doc, state, isPlaying)} ${this.#renderControls(state, isPlaying)}
            ${this.#renderDialogs(state)}
        `;
    }

    /** The Notes switch and the keypad, sized to this puzzle's alphabet. */
    #renderKeypad(doc, state, isPlaying) {
        return html`
            <div class="mode-bar">
                <pt-mode-toggle
                    .mode=${state.inputMode}
                    .disabled=${!isPlaying}
                    @pt-mode-change=${(event) => roomStore.setInputMode(event.detail.mode)}
                ></pt-mode-toggle>
            </div>
            <pt-keypad
                .alphabet=${doc.meta.alphabet ?? ''}
                .counts=${digitCounts(doc, state.view)}
                .capacity=${doc.size.rows}
                .canUndo=${state.canUndo}
                .disabled=${!isPlaying}
                @pt-keypad-digit=${this.#onKeypadDigit}
                @pt-keypad-erase=${this.#onKeypadErase}
                @pt-keypad-undo=${() => roomStore.undo()}
            ></pt-keypad>
        `;
    }

    /**
     * The assist buttons and the host's way out. Reveal is host-only and destructive, so it is the
     * one control behind a confirm dialog.
     */
    #renderControls(state, isPlaying) {
        const settings = state.room?.settings ?? {};

        return html`
            <div class="controls">
                ${
                    isPlaying
                        ? html`
                              <div class="assist-buttons">
                                  ${
                                      settings.checkingAllowed
                                          ? html`<button
                                                type="button"
                                                ?disabled=${this.busy}
                                                @click=${() => void roomStore.check()}
                                            >
                                                Check
                                            </button>`
                                          : nothing
                                  }
                                  ${
                                      roomStore.isHost && settings.revealAllowed
                                          ? html`<button
                                                type="button"
                                                ?disabled=${this.busy}
                                                @click=${() => {
                                                    this.confirmingReveal = true;
                                                }}
                                            >
                                                Reveal
                                            </button>`
                                          : nothing
                                  }
                              </div>
                          `
                        : nothing
                }
                ${
                    state.assists > 0
                        ? html`<p class="assists">
                              ${state.assists === 1 ? '1 assist' : `${state.assists} assists`} used
                          </p>`
                        : nothing
                }

                <p class="notice" role="status" aria-live="polite">${state.notice?.text ?? ''}</p>

                ${
                    roomStore.isHost
                        ? html`<button
                              class="back"
                              type="button"
                              ?disabled=${this.busy}
                              @click=${() => void roomStore.backToSelect()}
                          >
                              Back to Puzzle Select
                          </button>`
                        : nothing
                }

                <div class="leave">
                    <button type="button" @click=${this.#onLeave}>${leaveIcon} Leave room</button>
                </div>
            </div>
        `;
    }

    /**
     * Gives up the seat and returns to the landing screen, mid-puzzle as well as between them.
     *
     * Navigating is the whole implementation: `<pt-app>` releases the seat whenever the route
     * leaves a room, so this button and the browser's back button cannot drift apart.
     */
    #onLeave() {
        window.location.hash = '#/';
    }

    /** The confirm dialog for Reveal, and the congrats modal every player gets on completion. */
    #renderDialogs(state) {
        return html`
            <pt-confirm
                .open=${this.confirmingReveal}
                heading="Reveal the whole puzzle?"
                body="This fills in every square and ends your room's solve streak."
                confirmLabel="Reveal"
                @pt-confirm-cancel=${() => {
                    this.confirmingReveal = false;
                }}
                @pt-confirm-accept=${() => {
                    this.confirmingReveal = false;
                    void roomStore.reveal();
                }}
            ></pt-confirm>

            <pt-congrats-modal
                .solved=${state.solved}
                .isHost=${roomStore.isHost}
                .settings=${state.room?.settings ?? null}
                .busy=${this.busy}
                @pt-dismiss=${() => roomStore.dismissSolved()}
                @pt-start-another=${this.#onStartAnother}
                @pt-back-to-select=${() => void roomStore.backToSelect()}
            ></pt-congrats-modal>
        `;
    }
}

customElements.define('pt-game', PtGame);
