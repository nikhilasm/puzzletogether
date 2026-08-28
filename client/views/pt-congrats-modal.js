/**
 * The completion modal: solve time, streak, and, for the host, what to play next.
 *
 * Every player sees it and every player can dismiss it; dismissing leaves the finished grid on
 * screen. Only the host gets the start controls, and non-hosts are told plainly that they are
 * waiting rather than being shown buttons that would be rejected (design-spec.md §4).
 */

import { LitElement, css, html, nothing } from 'lit';

import { controls } from '../styles/controls.js';
import { closeIcon, iconStyle, puzzlesIcon, startIcon } from '../ui/icons.js';

import '../ui/pt-puzzle-picker.js';

/** Turns elapsedMs into the m:ss the modal shows. */
function formatElapsed(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export class PtCongratsModal extends LitElement {
    static properties = {
        solved: { type: Object },
        isHost: { type: Boolean },
        settings: { type: Object },
        /** What the server can serve, so "start another" offers exactly what Puzzle Select does. */
        catalog: { type: Object },
        busy: { state: true },
        spec: { state: true },
    };

    static styles = [
        controls,
        iconStyle,
        css`
            /*
             * As wide as Puzzle Select's column, because it holds the same picker and "start
             * another" should offer the same list at the same size rather than a cramped copy of it.
             * Everything above the picker is centred short text, which does not mind the room.
             */
            dialog {
                width: min(40rem, calc(100vw - 2 * var(--space-4)));
                padding: var(--space-6);
                border: var(--border);
                border-radius: var(--radius-modal);
                background: var(--paper-raised);
                color: var(--ink);
                text-align: center;
                box-shadow: var(--shadow-modal);
            }

            /*
             * The one modal in the app allowed to be seen arriving.
             *
             * Everything else opens as quietly as it can, because a confirm dialog is an
             * interruption. This one is the room finishing something together, and it was sharing
             * the confirm dialog's 160ms of a 4px drift, restrained to the point that people
             * reported it as appearing with no animation at all.
             *
             * It now rises further, scales up from just under full size, and takes --motion-celebrate
             * to do it. The easing overshoots slightly at the end, which is the whole of the
             * celebration: a panel that settles rather than stops reads as arriving rather than as
             * being switched on. Both tokens collapse to 0ms under prefers-reduced-motion.
             */
            dialog[open] {
                animation: celebrate var(--motion-celebrate) cubic-bezier(0.2, 0.9, 0.3, 1.25);
            }

            dialog::backdrop {
                background: color-mix(in srgb, var(--ink) 40%, transparent);
                animation: fade var(--motion-celebrate) ease-out;
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

            /*
             * Every way out of this modal, in one row.
             *
             * Not two rows with "See the grid" set apart below: three buttons under one picker are
             * three answers to one question, and the odd one out sitting alone read as a footer to
             * a dialog that has no footer. Dismissing is still what you do *after* deciding, and
             * the order carries that, since it is last.
             *
             * It wraps rather than shrinking, because the modal is as narrow as 320px on a phone and
             * three labelled buttons do not fit that.
             */
            .buttons {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-3);
                justify-content: center;
                margin-top: var(--space-4);
            }

            .buttons button {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
            }

            @keyframes celebrate {
                from {
                    opacity: 0;
                    transform: translateY(12px) scale(0.94);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes fade {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
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

    /** Announces intent; <pt-game> owns the store calls and the busy state around them. */
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
                ${this.isHost ? this.#renderPicker() : this.#renderWaiting()}
                <div class="buttons">
                    ${this.isHost ? this.#renderHostButtons() : nothing}
                    <button type="button" @click=${() => this.#emit('pt-dismiss', {})}>
                        ${closeIcon} See the grid
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

    /** What the host chooses from: the same picker Puzzle Select shows, over the same catalog. */
    #renderPicker() {
        return html`
            <hr class="divider" />
            <pt-puzzle-picker
                .spec=${this.spec ?? this.#defaultSpec}
                .catalog=${this.catalog}
                .disabled=${this.busy}
                @pt-spec-change=${(event) => {
                    this.spec = event.detail.spec;
                }}
            ></pt-puzzle-picker>
        `;
    }

    /**
     * The host's two choices, which share the button row with everybody's way out.
     *
     * The icons are the ones these actions already wear on the game screen: Puzzle Select is the
     * same four squares in both places, because it is the same action.
     */
    #renderHostButtons() {
        return html`
            <button type="button" ?disabled=${this.busy} @click=${this.#onStartAnother}>
                ${startIcon} ${this.busy ? 'finding a puzzle…' : 'Start another'}
            </button>
            <button
                type="button"
                ?disabled=${this.busy}
                @click=${() => this.#emit('pt-back-to-select', {})}
            >
                ${puzzlesIcon} Puzzle Select
            </button>
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
