/**
 * The game screen: puzzle header, timer, the shared grid, and every control that acts on it. Owns
 * no board state; it reads the store and turns board and keypad events back into store calls,
 * keeping every input path together (design-spec.md §11).
 */

import { LitElement, css, html, nothing } from 'lit';
import { html as staticHtml } from 'lit/static-html.js';

import { PUZZLE_TYPE_NAMES } from '../../shared/constants.js';
import { ROOM_STATE } from '../../shared/protocol.js';
import { effectiveValue, isEditable } from '../../shared/puzzle-doc.js';
import { CELEBRATION_MS, prefersReducedMotion } from '../boards/pt-celebration-layer.js';
import { boardFor } from '../boards/registry.js';
import { roomStore } from '../store/room-store.js';
import { StoreController } from '../store/store-controller.js';
import { actionButton, controls, dangerButton } from '../styles/controls.js';
import { helpFor } from '../ui/help-text.js';
import {
    checkIcon,
    helpIcon,
    iconStyle,
    leaveIcon,
    listIcon,
    puzzlesIcon,
    rebusIcon,
    revealIcon,
} from '../ui/icons.js';

import './pt-confirm.js';
import './pt-congrats-modal.js';
import '../ui/pt-brush-bar.js';
import '../ui/pt-clue-bar.js';
import '../ui/pt-clue-list.js';
import '../ui/pt-help.js';
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

/**
 * How many of each key the keypad should ever expect, so it dims a key only once the grid truly
 * has no more room for it. doc.size.rows is right for every type built on a full latin square
 * (sudoku, kenken, kakuro); a type whose per-digit ceiling is something else, like suguru's region
 * sizes (ADR-0019), says so itself via its registry entry's keyCapacity.
 */
function keyCapacities(doc, boardEntry) {
    const capacityForKey = boardEntry.keyCapacity ?? (() => doc.size.rows);
    const capacities = {};
    for (const key of doc.meta.alphabet) capacities[key] = capacityForKey(doc, key);
    return capacities;
}

export class PtGame extends LitElement {
    static properties = {
        confirmingReveal: { state: true },
        busy: { state: true },
        /** The crossword entry under this player's cursor, reported by the board. */
        entry: { state: true },
        showingClues: { state: true },
        showingHelp: { state: true },
        /** Whether the grid is running its solve wave, which the modal waits out. */
        celebrating: { state: true },
    };

    static styles = [
        actionButton,
        controls,
        dangerButton,
        iconStyle,
        css`
            :host {
                display: block;
            }

            /* Title and timer are a caption on the grid, a flex row centred as items so aligning the
               help control against the type asks neither engine for a baseline, and it wraps on a
               narrow screen. */
            .header {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-1);
                align-items: center;
                justify-content: center;
                margin: 0 0 var(--space-1);
                font-size: var(--text-lg);
                font-weight: 400;
                text-align: center;
            }

            .header strong {
                font-weight: 700;
            }

            /* The way into the rules, on the caption rather than the action row, since Help acts on
               nothing; borderless and --graphite like the roster's remove control, an annotation
               rather than a competing control. */
            .header .help {
                display: flex;
                flex: none;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                min-height: 2.25rem;
                padding: 0;
                border: none;
                background: none;
                color: var(--graphite);
                font-size: inherit;
            }

            /* The empty item that balances the help control at the row's other end, so flex centring
               lands the words where they would sit without it; drawn only when the control is. */
            .header .balance {
                flex: none;
                width: 2.25rem;
            }

            .header .help .icon {
                width: 1em;
                height: 1em;
            }

            @media (hover: hover) {
                .header .help:hover {
                    color: var(--ink);
                }
            }

            pt-timer {
                margin-bottom: var(--space-2);
            }

            .board {
                max-width: 480px;
                margin: 0 auto var(--space-6);
            }

            .controls {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                align-items: center;
            }

            /* Everything that acts on the puzzle or the room, in one row under a border rule
               (brand.md §1) that keeps it apart from the cell actions on the keypad; Leave room is
               last rather than a block of its own, saying what it is with colour. */
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

            /* Sits under the grid, kept in the DOM empty so the live region exists before text
               arrives, its margins hung off :not(:empty) so it takes no height until it has
               words. */
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

            @media (max-width: 480px) {
                .board {
                    margin-bottom: var(--space-4);
                }

                .controls {
                    gap: var(--space-3);
                }
            }
        `,
    ];

    // Everything this screen passes down, and nothing else: the roster changing does not need to
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
        state.rebus,
        state.catalog,
    ]);

    /** The wave's timer, and whether the last state we saw already held a result. */
    #celebrationTimer = null;
    #wasSolved = false;

    constructor() {
        super();
        this.confirmingReveal = false;
        this.busy = false;
        this.entry = null;
        this.showingClues = false;
        this.showingHelp = false;
        this.celebrating = false;
        // A screen that opens onto an already-finished puzzle has nothing to celebrate: the room
        // finished it before this element existed.
        this.#wasSolved = this.#store.state.solved != null;
    }

    /**
     * Starts the wave when a result lands, and holds the congrats modal back until it is over, on
     * the transition into a result so dismissing the modal does not celebrate twice. A reveal is not
     * a solve, so it gets no wave, agreeing with the modal's Revealed heading.
     */
    willUpdate() {
        const solved = this.#store.state.solved;
        const wasSolved = this.#wasSolved;
        this.#wasSolved = solved != null;

        if (solved == null) {
            this.#stopCelebrating();
            return;
        }

        if (wasSolved || solved.revealed || prefersReducedMotion()) return;

        this.celebrating = true;
        this.#celebrationTimer = setTimeout(() => {
            this.#celebrationTimer = null;
            this.celebrating = false;
        }, CELEBRATION_MS);
    }

    /** Ends the wave early: a new puzzle, or this screen going away underneath it. */
    #stopCelebrating() {
        clearTimeout(this.#celebrationTimer);
        this.#celebrationTimer = null;
        this.celebrating = false;
    }

    /** Nothing may be waiting on a timer once this screen is gone. */
    disconnectedCallback() {
        this.#stopCelebrating();
        super.disconnectedCallback();
    }

    /**
     * The board element, for the few things only it knows: where the cursor goes next, and which
     * way it is pointing.
     *
     * Reached by query rather than by ref because the tag varies per puzzle type: boardFor hands
     * back a literal, so there is one element in that slot and its name is not known here.
     */
    get #board() {
        return this.renderRoot.querySelector('.board')?.firstElementChild ?? null;
    }

    /**
     * Moves the cursor along after a value lands, if this puzzle type advances at all. Called from
     * both input paths so the physical keyboard and the pad cannot drift apart (design-spec.md §11).
     */
    #advance(cell) {
        const next = this.#board?.advanceAfterInput?.(cell);
        if (next != null) roomStore.setSelection(next);
    }

    /** Moves the local selection, which is also what broadcasts presence. */
    #onSelect(event) {
        roomStore.setSelection(event.detail.cell);
    }

    /**
     * A value from the grid's own keyboard handling.
     *
     * The branch is on how this puzzle takes input, never on which puzzle it is: a letter goes in
     * whole (and may extend a rebus square), a digit goes through the Notes/Solve fork.
     */
    #onCellInput(event) {
        const { cell, value, shiftKey } = event.detail;
        this.#apply(cell, value, shiftKey === true);
    }

    /**
     * One value into one square, wherever the press came from.
     *
     * The physical keyboard and the panel's keys both land here, which is the one-input-path rule
     * made literal (design-spec.md §11): there is no way for a key on the pad and the same key on
     * the keyboard to mean different things, because they are not two pieces of code.
     */
    #apply(cell, value, shiftKey = false) {
        if (!this.#takesLetters) {
            roomStore.inputDigit(cell, value);
            this.#advance(cell);
            return;
        }

        const append = this.#store.state.rebus || shiftKey;
        roomStore.inputLetter(cell, value, append);
        // A square being built into a word keeps the cursor. Advancing after each letter would
        // scatter the word one letter per square, which is the opposite of what was asked for.
        if (!append) this.#advance(cell);
    }

    /**
     * Backspace or Delete on the grid. In a crossword this peels one letter off so a rebus square
     * can be corrected a letter at a time; everywhere else it clears the square.
     */
    #onCellClear(event) {
        if (this.#takesLetters) roomStore.backspaceLetter(event.detail.cell);
        else roomStore.clearCell(event.detail.cell);
    }

    /** Whether this puzzle's squares hold letters, which is the only branch its input needs. */
    get #takesLetters() {
        const doc = this.#store.state.doc;
        return doc != null && boardFor(doc.type).input === 'letters';
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

    /** A key from the panel, routed through the same path as the physical keyboard. */
    #onKeypadKey(event) {
        const cell = this.#targetCell();
        if (cell == null) return;
        this.#apply(cell, event.detail.value);
    }

    /**
     * The panel's Backspace, which only a crossword has.
     *
     * Asked of the board rather than done here, because backspacing a crossword is a rule about
     * *entries*, namely take a letter out then step back along the word without ever leaving it,
     * and the board is the only thing that knows where the word goes.
     */
    #onKeypadBackspace() {
        this.#board?.backspace();
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

        // Twice, because the mark and the item that offsets it sit either side of the words.
        const help = helpFor(doc.type);

        return html`
            <h2 class="header">
                ${help ? html`<span class="balance" aria-hidden="true"></span>` : nothing}
                <span><strong>${type}</strong>: ${difficulty} ${size}</span>
                ${
                    help
                        ? html`<button
                              class="help"
                              type="button"
                              aria-label=${`How to play ${type}`}
                              title="How to play"
                              @click=${() => {
                                  this.showingHelp = true;
                              }}
                          >
                              ${helpIcon}
                          </button>`
                        : nothing
                }
            </h2>
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
                @pt-mode-change=${(event) => roomStore.setInputMode(event.detail.mode)}
                @pt-undo=${() => roomStore.undo()}
                @pt-entry-change=${(event) => {
                    this.entry = event.detail.entry;
                }}
            >
                ${this.#renderBoard(board, doc, state, isPlaying)}
            </div>

            ${this.#renderPanel(board, doc, state, isPlaying)}

            <p class="notice" role="status" aria-live="polite">${state.notice?.text ?? ''}</p>

            ${this.#renderControls(state, isPlaying)} ${this.#renderDialogs(state)}
            ${this.#renderClueList(board, state)}
        `;
    }

    /**
     * The grid itself, whichever element this puzzle type renders with.
     *
     * A static template so the tag can vary while lit still caches one template per board type:
     * boardFor hands back a literal, not a string, which is what keeps this from re-parsing the
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
                .inputMode=${state.inputMode}
                .hasNotes=${board.input === 'digits'}
                .celebrating=${this.celebrating}
            ></${board.tag}>
        `;
    }

    /**
     * The pinned input panel: this puzzle's keys, its one setting, and its clue if it has one. It
     * follows the grid in the DOM even though drawn at the foot, so a keyboard or screen-reader user
     * meets the keys next, and everything type-specific is slotted from here.
     */
    #renderPanel(board, doc, state, isPlaying) {
        const letters = board.input === 'letters';
        /*
         * Only a digit puzzle has keys to count and cap.
         *
         * A brush type has no alphabet in its meta at all, so both of those have to be skipped
         * rather than computed over nothing: keyCapacities iterating an absent alphabet is what
         * threw during render and left nonogram with no game screen at all.
         */
        const digits = board.input === 'digits';

        return html`
            <pt-keypad
                .layout=${letters ? 'letters' : 'digits'}
                .alphabet=${board.input === 'brushes' ? '' : doc.meta.alphabet}
                .counts=${digits ? digitCounts(doc, state.view) : {}}
                .capacities=${digits ? keyCapacities(doc, board) : {}}
                .canUndo=${state.canUndo}
                .disabled=${!isPlaying}
                @pt-keypad-key=${this.#onKeypadKey}
                @pt-keypad-erase=${this.#onKeypadErase}
                @pt-keypad-backspace=${this.#onKeypadBackspace}
                @pt-keypad-undo=${() => roomStore.undo()}
            >
                ${
                    letters
                        ? html`<pt-clue-bar
                              slot="clue"
                              .entry=${this.entry}
                              @pt-clue-next=${() => this.#board?.moveToNextClue()}
                          ></pt-clue-bar>`
                        : nothing
                }
                ${this.#renderSetting(board, state, isPlaying)}
            </pt-keypad>
        `;
    }

    /**
     * The one setting beside the keys that changes what a keypress means: Notes for digits, a brush
     * for nonogram, Rebus for crossword, always in the same slot so the screen's shape never changes
     * (design-spec.md §4). Crossword adds the way into the clue list, being the only type whose
     * puzzle is partly written off the grid.
     */
    #renderSetting(board, state, isPlaying) {
        if (board.input === 'brushes') {
            return html`<pt-brush-bar
                slot="actions"
                .brush=${state.brush}
                .disabled=${!isPlaying}
                @pt-brush-change=${(event) => roomStore.setBrush(event.detail.brush)}
            ></pt-brush-bar>`;
        }

        if (board.input === 'letters') {
            // Clues leads the row, the only control here that opens the puzzle's other half rather
            // than acting on a square. Rebus, Backspace, and Undo follow, in the order the other
            // types put their setting and corrections.
            return html`
                <button
                    slot="actions"
                    class="action"
                    type="button"
                    aria-label="All clues"
                    @pointerdown=${(event) => event.preventDefault()}
                    @click=${() => {
                        this.showingClues = true;
                    }}
                >
                    ${listIcon}<span class="action-label">Clues</span>
                </button>
                <button
                    slot="actions"
                    class="action"
                    type="button"
                    aria-pressed=${state.rebus}
                    ?disabled=${!isPlaying}
                    @pointerdown=${(event) => event.preventDefault()}
                    @click=${() => roomStore.setRebus(!state.rebus)}
                >
                    ${rebusIcon}<span class="action-label">Rebus</span>
                </button>
            `;
        }

        return html`<pt-mode-toggle
            slot="actions"
            .mode=${state.inputMode}
            .disabled=${!isPlaying}
            @pt-mode-change=${(event) => roomStore.setInputMode(event.detail.mode)}
        ></pt-mode-toggle>`;
    }

    /** The full clue list, for the one type that has clues. A dialog, so it renders where it likes. */
    #renderClueList(board, state) {
        if (board.input !== 'letters') return nothing;

        return html`
            <pt-clue-list
                .open=${this.showingClues}
                .entries=${state.doc?.meta?.entries ?? []}
                .current=${this.entry}
                .filled=${state.view.cells}
                @pt-clues-close=${() => {
                    this.showingClues = false;
                }}
                @pt-clue-pick=${this.#onCluePick}
            ></pt-clue-list>
        `;
    }

    /**
     * Picking a clue moves the cursor to that entry and closes the list.
     *
     * It lands on the entry's first *empty* square rather than its first square, because arriving on
     * a letter somebody has already filled in makes the next keystroke overwrite their work, which
     * in a room solving together is somebody else's.
     */
    #onCluePick(event) {
        const entry = event.detail.entry;
        this.showingClues = false;
        const board = this.#board;
        if (!board) return;

        const cells = entry.cells;
        const view = this.#store.state.view;
        const doc = this.#store.state.doc;
        const open = cells.find((cell) => effectiveValue(doc, view, cell) == null);
        board.goTo(open ?? cells[0], entry.dir);
    }

    /**
     * The row of actions on the puzzle and on the room, under its rule, rendering only the actions
     * this player has. Every player has Leave room, so the rule is always drawn around something.
     */
    #renderControls(state, isPlaying) {
        const settings = state.room?.settings ?? {};
        const canCheck = isPlaying && settings.checkingAllowed;
        const canReveal = isPlaying && roomStore.isHost && settings.revealAllowed;
        const canGoBack = roomStore.isHost;

        return html`
            <div class="controls">
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
                    <button class="danger leave" type="button" @click=${this.#onLeave}>
                        ${leaveIcon} Leave Room
                    </button>
                </div>
                ${
                    state.assists > 0
                        ? html`<p class="assists">
                              ${state.assists === 1 ? '1 assist' : `${state.assists} assists`} used
                          </p>`
                        : nothing
                }
            </div>
        `;
    }

    /**
     * Gives up the seat and returns to the landing screen, mid-puzzle as well as between them.
     *
     * Navigating is the whole implementation: <pt-app> releases the seat whenever the route
     * leaves a room, so this button and the browser's back button cannot drift apart.
     */
    #onLeave() {
        window.location.hash = '#/';
    }

    /**
     * The confirm dialog for Reveal, the rules of this puzzle type, and the congrats modal every
     * player gets on completion.
     *
     * The modal is simply handed the result late while the grid is celebrating, rather than being
     * told to wait: it opens on solved arriving and knows nothing about a wave, which keeps the
     * sequencing in the one place that owns both halves of it.
     */
    #renderDialogs(state) {
        return html`
            <pt-help
                .open=${this.showingHelp}
                .type=${state.doc?.type ?? ''}
                @pt-help-close=${() => {
                    this.showingHelp = false;
                }}
            ></pt-help>
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
                .solved=${this.celebrating ? null : state.solved}
                .isHost=${roomStore.isHost}
                .settings=${state.room?.settings ?? null}
                .catalog=${state.catalog}
                .busy=${this.busy}
                @pt-dismiss=${() => roomStore.dismissSolved()}
                @pt-start-another=${this.#onStartAnother}
                @pt-back-to-select=${() => void roomStore.backToSelect()}
            ></pt-congrats-modal>
        `;
    }
}

customElements.define('pt-game', PtGame);
