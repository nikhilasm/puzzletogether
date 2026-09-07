/**
 * The completion modal: solve time, streak, and, for the host, what to play next. Every player sees
 * and can dismiss it; only the host gets the start controls, non-hosts told plainly they are waiting
 * (design-spec.md §4).
 */

import { LitElement, css, html, nothing } from 'lit';

import { accentButton, controls } from '../styles/controls.js';
import { closeIcon, iconStyle, puzzlesIcon, startIcon } from '../ui/icons.js';

import '../ui/pt-puzzle-picker.js';

/** Turns elapsedMs into the m:ss the modal shows. */
function formatElapsed(elapsedMs) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** Headings a solve can open with. Plain enough to say "solved" without repeating the word every time. */
const SOLVED_TITLES = [
    'Solved!',
    'Impressive!',
    'Nice work!',
    'Terrific!',
    'Exemplary!',
    'Marvelous!',
    'Brilliant!',
    'Well done!',
];

/** Rare on purpose: one draw in twenty, so it stays a surprise rather than becoming the usual heading. */
const RARE_TITLE = 'Light Work 😤';
const RARE_CHANCE = 0.05;

/** Picks the heading for one solve: mostly the word bank, occasionally the rare line. */
function pickSolvedTitle() {
    if (Math.random() < RARE_CHANCE) return RARE_TITLE;
    return SOLVED_TITLES[Math.floor(Math.random() * SOLVED_TITLES.length)];
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
        accentButton,
        iconStyle,
        css`
            /* As wide as Puzzle Select's column since it holds the same picker, with no position here
               (see pt-about) so the UA's dialog:modal centring is not overridden into the
               document. */
            dialog {
                width: min(40rem, calc(100vw - 2 * var(--space-4)));
                padding: 0;
                border: var(--border);
                border-radius: var(--radius-modal);
                background: var(--paper-raised);
                color: var(--ink);
                text-align: center;
                box-shadow: var(--shadow-modal);
            }

            /* The one modal allowed to be seen arriving: it rises and scales up over
               --motion-celebrate with an easing that overshoots slightly so it reads as arriving,
               collapsing to 0ms under prefers-reduced-motion. */
            dialog[open] {
                animation: celebrate var(--motion-celebrate) cubic-bezier(0.2, 0.9, 0.3, 1.25);
            }

            dialog::backdrop {
                background: color-mix(in srgb, var(--ink) 40%, transparent);
                animation: fade var(--motion-celebrate) ease-out;
            }

            /* The positioned box the close button hangs off, and the panel's padding. */
            .sheet {
                position: relative;
                padding: var(--space-6);
            }

            /* The close control in the corner rather than the row below (matching pt-about and
               pt-help), since dismissing is not one of the start controls' answers. */
            .close {
                position: absolute;
                top: var(--space-3);
                right: var(--space-3);
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                min-height: 2.25rem;
                padding: 0;
                border: none;
                background: none;
                color: var(--graphite);
            }

            @media (hover: hover) {
                .close:hover {
                    color: var(--ink);
                }
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

            /* The streak, lit by a gradient clipped to the text (both clip properties for
               cross-engine support) and a glow, both set inline per render and 0 for a broken
               streak, in --accent-text since this line is body-sized (brand.md §2). */
            .streak-line {
                margin: 0 0 var(--space-2);
                font-size: var(--text-base);
                background-image: linear-gradient(
                    90deg,
                    var(--ink) 0%,
                    color-mix(in srgb, var(--accent-text) calc(var(--wave-t, 0) * 100%), var(--ink))
                        50%,
                    var(--ink) 100%
                );
                background-size: 200% 100%;
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                color: transparent;
                text-shadow: 0 0 calc(var(--streak-t, 0) * 18px)
                    color-mix(in srgb, var(--accent) calc(var(--streak-t, 0) * 90%), transparent);
                animation: streak-wave 3.2s linear infinite;
            }

            @keyframes streak-wave {
                from {
                    background-position: 0% 0;
                }
                to {
                    background-position: -200% 0;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .streak-line {
                    animation: none;
                }
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

            /* The host's two ways on, in one row with Start another last and accent-bordered as the
               action most rooms take; it wraps since two labelled buttons do not always fit 320px. */
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
                <div class="sheet">
                    <button
                        class="close"
                        type="button"
                        aria-label="Close"
                        title="Close"
                        @click=${() => this.#emit('pt-dismiss', {})}
                    >
                        ${closeIcon}
                    </button>

                    <h2 id="congrats-heading">${solved.revealed ? 'Revealed' : this.#title}</h2>
                    <p class="time">${formatElapsed(solved.elapsedMs)}</p>
                    <p class="streak-line" style=${this.#streakPaint(solved)}>
                        ${this.#streakLine(solved)}
                    </p>
                    <p class="detail">${this.#assistsLine(solved)}</p>
                    ${this.isHost ? this.#renderPicker() : this.#renderWaiting()}
                    ${
                        this.isHost
                            ? html`<div class="buttons">${this.#renderHostButtons()}</div>`
                            : nothing
                    }
                </div>
            </dialog>
        `;
    }

    /** The heading text for the current solve, picked once and stable until a new one arrives. */
    #titleValue = null;
    #titleFor = null;
    get #title() {
        if (this.solved !== this.#titleFor) {
            this.#titleFor = this.solved;
            this.#titleValue = pickSolvedTitle();
        }
        return this.#titleValue;
    }

    /**
     * The two numbers the streak line is painted from, as an inline style, both 0 for a broken
     * streak. The glow scales straight off the streak, while the wave has a small floor so a low
     * streak's accent stays visible in the light theme.
     */
    #streakPaint(solved) {
        const climb = Math.min(solved.streak, 20) / 20;
        const wave = solved.streak === 0 ? 0 : 0.15 + 0.85 * climb;
        return `--streak-t: ${climb}; --wave-t: ${wave}`;
    }

    /** What changed the streak, or what broke it. Its size and motion carry the emphasis (see .streak-line). */
    #streakLine(solved) {
        if (solved.revealed) return 'Streak broken!';
        return `Solve streak ${solved.streak}`;
    }

    /** The assist count, its own line under the streak. */
    #assistsLine(solved) {
        return solved.assists === 1 ? '1 assist' : `${solved.assists} assists`;
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
     * The host's two choices, and the whole of the button row; a non-host gets no row, since an
     * empty flex box would still reserve its margin. The icons match the game screen's, and Start
     * another carries the accent border as the action this row is built around.
     */
    #renderHostButtons() {
        return html`
            <button
                type="button"
                ?disabled=${this.busy}
                @click=${() => this.#emit('pt-back-to-select', {})}
            >
                ${puzzlesIcon} Puzzle Select
            </button>
            <button
                class="accent"
                type="button"
                ?disabled=${this.busy}
                @click=${this.#onStartAnother}
            >
                ${startIcon} ${this.busy ? 'finding a puzzle…' : 'Start another'}
            </button>
        `;
    }

    /** What everyone else sees: the puzzles on offer, greyed, and that the host is choosing. */
    #renderWaiting() {
        return html`
            <hr class="divider" />
            <pt-puzzle-picker readonly .catalog=${this.catalog}></pt-puzzle-picker>
            <p class="waiting">waiting for the host to pick the next puzzle…</p>
        `;
    }
}

customElements.define('pt-congrats-modal', PtCongratsModal);
