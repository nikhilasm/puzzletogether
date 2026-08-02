/**
 * The completion modal: solve time, streak, and — for the host — what to play next.
 *
 * Every player sees it and every player can dismiss it; dismissing leaves the finished grid on
 * screen. Only the host gets the start controls, and non-hosts are told plainly that they are
 * waiting rather than being shown buttons that would be rejected (design-spec.md §4).
 */

import { LitElement, css, html, nothing } from 'lit';

import { controls } from '../styles/controls.js';

import '../ui/pt-puzzle-picker.js';

/** Turns `elapsedMs` into the `m:ss` the modal shows. */
function formatElapsed(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export class PtCongratsModal extends LitElement {
    static properties = {
        solved: { type: Object },
        isHost: { type: Boolean },
        settings: { type: Object },
        busy: { state: true },
        spec: { state: true },
    };

    static styles = [
        controls,
        css`
            dialog {
                width: min(26rem, calc(100vw - 2 * var(--space-4)));
                padding: var(--space-6);
                border: var(--border);
                border-radius: var(--radius-modal);
                background: var(--paper-raised);
                color: var(--ink);
                text-align: center;
                box-shadow: var(--shadow-modal);
            }

            dialog[open] {
                animation: rise var(--motion-modal) ease-out;
            }

            dialog::backdrop {
                background: color-mix(in srgb, var(--ink) 40%, transparent);
            }

            h2 {
                margin: 0 0 var(--space-2);
                font-family: var(--font-display);
                font-variation-settings: var(--wordmark-variation);
                font-size: var(--text-xl);
                font-weight: 600;
            }

            .time {
                margin: 0 0 var(--space-1);
                font-size: var(--text-lg);
                font-variant-numeric: tabular-nums;
            }

            .detail {
                margin: 0 0 var(--space-6);
                color: var(--graphite);
                font-size: var(--text-sm);
            }

            .divider {
                margin: var(--space-6) 0 var(--space-4);
                border: none;
                border-top: var(--border);
            }

            .buttons {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-3);
                justify-content: center;
            }

            /* Last, and quiet: leaving the modal is what you do after deciding what comes next. */
            .dismiss {
                margin-top: var(--space-4);
            }

            @keyframes rise {
                from {
                    opacity: 0;
                    transform: translateY(4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `,
    ];

    constructor() {
        super();
        this.solved = null;
        this.isHost = false;
        this.settings = null;
        this.busy = false;
        this.spec = null;
    }

    /** Shows the dialog whenever a fresh, undismissed result arrives. */
    updated(changed) {
        if (!changed.has('solved')) return;

        const dialog = this.renderRoot.querySelector('dialog');
        if (!dialog) return;

        const shouldShow = Boolean(this.solved) && !this.solved.dismissed;
        if (shouldShow && !dialog.open) dialog.showModal();
        if (!shouldShow && dialog.open) dialog.close();
    }

    /** Announces intent; `<pt-game>` owns the store calls and the busy state around them. */
    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    /** Starts another puzzle with whatever the picker currently holds. */
    #onStartAnother() {
        this.#emit('pt-start-another', { spec: this.spec ?? this.#defaultSpec });
    }

    /** The puzzle just finished, which is what "start another" should offer first. */
    get #defaultSpec() {
        const settings = this.settings ?? {};
        return { type: settings.type, difficulty: settings.difficulty, size: settings.size };
    }

    render() {
        const solved = this.solved;
        if (!solved) return nothing;

        return html`
            <dialog
                aria-labelledby="congrats-heading"
                @cancel=${() => this.#emit('pt-dismiss', {})}
            >
                <h2 id="congrats-heading">${solved.revealed ? 'Revealed' : 'Solved!'}</h2>
                <p class="time">${formatElapsed(solved.elapsedMs)}</p>
                <p class="detail">${this.#detailLine(solved)}</p>
                ${this.isHost ? this.#renderHostControls() : this.#renderWaiting()}
                <div class="buttons dismiss">
                    <button type="button" @click=${() => this.#emit('pt-dismiss', {})}>
                        See the grid
                    </button>
                </div>
            </dialog>
        `;
    }

    /** Streak and assists in one line, saying plainly why a reveal left the streak at zero. */
    #detailLine(solved) {
        const assists = solved.assists === 1 ? '1 assist' : `${solved.assists} assists`;
        if (solved.revealed) return `Streak reset to 0 · ${assists}`;
        return `Solve streak ${solved.streak} · ${assists}`;
    }

    /** What the host does next: another puzzle, or back to Puzzle Select for everyone. */
    #renderHostControls() {
        return html`
            <hr class="divider" />
            <pt-puzzle-picker
                .spec=${this.spec ?? this.#defaultSpec}
                .disabled=${this.busy}
                @pt-spec-change=${(event) => {
                    this.spec = event.detail.spec;
                }}
            ></pt-puzzle-picker>
            <div class="buttons">
                <button type="button" ?disabled=${this.busy} @click=${this.#onStartAnother}>
                    ${this.busy ? 'finding a puzzle…' : 'Start another'}
                </button>
                <button
                    type="button"
                    ?disabled=${this.busy}
                    @click=${() => this.#emit('pt-back-to-select', {})}
                >
                    Puzzle Select
                </button>
            </div>
        `;
    }

    /** What everyone else sees: the host is choosing, and there is nothing to press. */
    #renderWaiting() {
        return html`
            <hr class="divider" />
            <p class="waiting">waiting for the host to pick the next puzzle…</p>
        `;
    }
}

customElements.define('pt-congrats-modal', PtCongratsModal);
