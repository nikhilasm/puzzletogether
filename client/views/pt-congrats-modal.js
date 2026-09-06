/**
 * The completion modal: solve time, streak, and, for the host, what to play next.
 *
 * Every player sees it and every player can dismiss it; dismissing leaves the finished grid on
 * screen. Only the host gets the start controls, and non-hosts are told plainly that they are
 * waiting rather than being shown buttons that would be rejected (design-spec.md §4).
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
            /*
             * As wide as Puzzle Select's column, because it holds the same picker and "start
             * another" should offer the same list at the same size rather than a cramped copy of it.
             * Everything above the picker is centred short text, which does not mind the room.
             *
             * No position here, deliberately, for the reason pt-about records: a modal dialog is
             * centred by the UA's own dialog:modal rule, and position: relative to hang the close
             * button off overrides it and drops the panel into the document. The padding moved to
             * .sheet so the close button has a containing block that owns it.
             */
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

            /* The positioned box the close button hangs off, and the panel's padding. */
            .sheet {
                position: relative;
                padding: var(--space-6);
            }

            /*
             * The close control, in the corner rather than as a button in the row below, matching
             * pt-about and pt-help.
             *
             * It used to be a labelled "See the grid" sharing the row with the host's two start
             * controls, which put a way out of the dialog next to two ways on to the next puzzle
             * and made the row read as three answers to one question. Dismissing is not one of the
             * answers, so it moved to the corner every other panel keeps it in.
             */
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

            /*
             * The streak, lit to carry the emphasis the old one-line detail text couldn't. Both
             * effects are set inline per render, and a broken streak sets both to 0, which is what
             * leaves it plain ink rather than faintly lit.
             *
             * Between the time above it and the assists below: emphasis here is colour and motion,
             * so the type does not also have to be the largest thing in the dialog.
             *
             * The wave is a gradient clipped to the text rather than an animated colour, since a
             * flat colour tween cannot put a moving band of accent across a fixed word; both
             * clip properties are set because Firefox and Chromium disagree on which one they
             * accept unprefixed.
             *
             * --accent-text and not --accent, because at the wave's peak the accent *is* the text
             * colour, and this line is body-sized (brand.md §2). On dark the two tokens are the
             * same value, so only the light theme sees a difference.
             */
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

            /*
             * The host's two ways on from here, in one row under the picker. Start another is last
             * and accent-bordered: it is the action most rooms take, and last is where reading the
             * row left to right lands you.
             *
             * It wraps rather than shrinking, because the modal is as narrow as 320px on a phone and
             * two labelled buttons do not always fit that.
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
     * The two numbers the streak line is painted from, as an inline style.
     *
     * They climb together to a streak of 20 and are both 0 for a broken one, but they do not climb
     * the same way. The glow is a shadow *behind* ink, so scaling it straight off the streak reads
     * correctly the whole way up. The wave is the ink, and mixing accent into it in proportion to a
     * low streak is a few percent of accent against near-black: invisible in the light theme, which
     * is the bug this split fixes. So the wave has a small floor that keeps it visible from a streak
     * of 1 while starting subtle, and the streak decides how much further toward pure accent it goes.
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
     * The host's two choices, and the whole of the button row. A non-host gets no row at all: the
     * corner close is their only control, and an empty flex box would still reserve its margin.
     *
     * The icons are the ones these actions already wear on the game screen: Puzzle Select is the
     * same four squares in both places, because it is the same action. Start another carries the
     * accent border and icon (accentButton in controls.js): it is the one this row is built around.
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
