/**
 * The game screen: puzzle header, timer, the shared grid, and every control that acts on it.
 *
 * Owns no board state. It reads the store, hands the board and keypad what they need, and turns
 * their events back into store calls — which is what keeps physical keyboard, on-screen keypad, and
 * touch on one input path (design-spec.md §11). The only local state is which dialog is open.
 */

import { LitElement, css, html, nothing } from 'lit';
import { html as staticHtml } from 'lit/static-html.js';

import { PUZZLE_TYPE_NAMES } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { effectiveValue, isEditable } from '../../shared/puzzle-doc.js';
import { boardFor } from '../boards/registry.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { controls } from '../styles/controls.js';
import { checkIcon, iconStyle, leaveIcon, puzzlesIcon, revealIcon } from '../ui/icons.js';

import './pt-confirm.js';
import './pt-congrats-modal.js';
import '../ui/pt-brush-bar.js';
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

            /* Title and timer are a caption on the grid, not a banner above it: they sit close
               enough to read as one block with it, and the type steps down so the grid stays the
               largest thing on the screen. Weight, not size, is what separates them from the
               timer underneath. */
            .header {
                margin: 0 0 var(--space-1);
                font-size: var(--text-lg);
                font-weight: 400;
                text-align: center;
            }

            .header strong {
                font-weight: 700;
            }

            pt-timer {
                margin-bottom: var(--space-2);
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

            /*
             * Everything that acts on the puzzle as a whole, in one row under a rule.
             *
             * Erase and Undo live on the keypad because they act on the cell you are in; Check,
             * Reveal, and Back to Puzzle Select act on the room's puzzle, and two of the three are
             * host-only. Keeping them apart is what stops a player reaching for Undo and finding
             * Reveal. The rule is the separation — a border, not a shadow (brand.md §1).
             */
            .puzzle-actions {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-3);
                justify-content: center;
                width: 100%;
                max-width: 480px;
                padding-top: var(--space-4);
                border-top: var(--border);
            }

            .puzzle-actions button {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
            }

            .assists {
                margin: 0;
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            /*
             * Sits under the keys, where the actions it reports on are.
             *
             * It stays in the DOM empty rather than being rendered conditionally — a live region
             * has to exist before the text arrives or the announcement is missed — and takes no
             * height at all in that state: an empty block has no line box, and the margins are
             * hung off :not(:empty) so they arrive with the words.
             */
            .notice {
                margin: 0;
                color: var(--graphite);
                font-size: var(--text-sm);
                font-style: italic;
                text-align: center;
            }

            .notice:not(:empty) {
                margin-bottom: var(--space-3);
            }

            /* Same control, same place in the reading order, on both screens. */
            .leave {
                margin-top: var(--space-2);
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
        state.brush,
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

    /** A finished nonogram stroke, already batched by the board into one run of cells. */
    #onPaint(event) {
        roomStore.paintCells(event.detail.cells, event.detail.value);
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
        const type = PUZZLE_TYPE_NAMES[doc.type] ?? doc.type;
        const isPlaying = state.room?.state === ROOM_STATE.PLAYING;
        const board = boardFor(doc.type);

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
                @pt-cells-paint=${this.#onPaint}
                @pt-undo=${() => roomStore.undo()}
            >
                ${this.#renderBoard(board, doc, state, isPlaying)}
            </div>

            ${this.#renderInput(board, doc, state, isPlaying)}

            <p class="notice" role="status" aria-live="polite">${state.notice?.text ?? ''}</p>

            ${this.#renderControls(state, isPlaying)} ${this.#renderDialogs(state)}
        `;
    }

    /**
     * The grid itself, whichever element this puzzle type renders with.
     *
     * A static template so the tag can vary while lit still caches one template per board type —
     * `boardFor` hands back a `literal`, not a string, which is what keeps this from re-parsing the
     * template on every render.
     */
    #renderBoard(board, doc, state, isPlaying) {
        return staticHtml`
            <${board.tag}
                .doc=${doc}
                .board=${state.view}
                .focus=${state.focus}
                .players=${state.room?.players ?? []}
                .selfId=${state.playerId}
                .selection=${state.selection}
                .checkResults=${state.checkResults}
                .interactive=${isPlaying}
                .brush=${state.brush}
            ></${board.tag}>
        `;
    }

    /**
     * Whatever decides what an input means, over the row that acts on a cell.
     *
     * The branch is on how the puzzle takes input, not on which puzzle it is — a nonogram has brushes
     * where a sudoku has digits, and the crossword that arrives in Phase 4 has neither. The Undo row
     * underneath is common to all of them.
     */
    #renderInput(board, doc, state, isPlaying) {
        const setting =
            board.input === 'brushes'
                ? html`<pt-brush-bar
                      .brush=${state.brush}
                      .disabled=${!isPlaying}
                      @pt-brush-change=${(event) => roomStore.setBrush(event.detail.brush)}
                  ></pt-brush-bar>`
                : html`<pt-mode-toggle
                      .mode=${state.inputMode}
                      .disabled=${!isPlaying}
                      @pt-mode-change=${(event) => roomStore.setInputMode(event.detail.mode)}
                  ></pt-mode-toggle>`;

        return html`
            <div class="mode-bar">${setting}</div>
            <pt-keypad
                .alphabet=${(board.input === 'digits' && doc.meta.alphabet) || ''}
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
     * The puzzle-wide actions, then the way out of the room.
     *
     * The row renders only the actions this player actually has, and disappears entirely for a
     * non-host in a room with checking switched off — an empty rule under the keypad would be a
     * line drawn around nothing.
     */
    #renderControls(state, isPlaying) {
        const settings = state.room?.settings ?? {};
        const canCheck = isPlaying && settings.checkingAllowed;
        const canReveal = isPlaying && roomStore.isHost && settings.revealAllowed;
        const canGoBack = roomStore.isHost;

        return html`
            <div class="controls">
                ${
                    canCheck || canReveal || canGoBack
                        ? html`
                              <div class="puzzle-actions">
                                  ${
                                      canGoBack
                                          ? html`<button
                                                type="button"
                                                ?disabled=${this.busy}
                                                @click=${() => void roomStore.backToSelect()}
                                            >
                                                ${puzzlesIcon} Puzzle Select
                                            </button>`
                                          : nothing
                                  }
                                  ${
                                      canCheck
                                          ? html`<button
                                                type="button"
                                                ?disabled=${this.busy}
                                                @click=${() => void roomStore.check()}
                                            >
                                                ${checkIcon} Check
                                            </button>`
                                          : nothing
                                  }
                                  ${
                                      canReveal
                                          ? html`<button
                                                type="button"
                                                ?disabled=${this.busy}
                                                @click=${() => {
                                                    this.confirmingReveal = true;
                                                }}
                                            >
                                                ${revealIcon} Reveal
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
