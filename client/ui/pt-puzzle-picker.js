/**
 * The type / difficulty / size pickers, shared by Puzzle Select and the congrats modal.
 *
 * One component in both places so "start another" offers exactly the choices Puzzle Select does,
 * defaulted to the puzzle just finished (design-spec.md §4).
 *
 * Holds the working selection as its own state and reports it on every change; the screen around it
 * decides when to turn that into a `game:start`.
 */

import { LitElement, css, html, nothing } from 'lit';

import {
    DIFFICULTIES,
    DIFFICULTY_MIN_SIDE,
    PUZZLE_TYPES,
    PUZZLE_TYPE_NAMES,
    SIZES_BY_TYPE,
    SIZE_CAUTION,
} from '../../shared/constants.js';
import { controls, optionGroup } from '../styles/controls.js';

import { iconStyle, warningIcon } from './icons.js';

/** Sentence-cases a token for display without touching the value that travels over the wire. */
function titleCase(value) {
    return value[0].toUpperCase() + value.slice(1);
}

export class PtPuzzlePicker extends LitElement {
    static properties = {
        spec: { type: Object },
        disabled: { type: Boolean },
    };

    static styles = [
        controls,
        optionGroup,
        iconStyle,
        css`
            :host {
                display: block;
            }

            /* The triangle leads the label, so the caveat is read before the choice, not after it. */
            .option {
                display: inline-flex;
                gap: var(--space-2);
                align-items: center;
            }

            .option .icon {
                width: 1em;
                height: 1em;
            }

            /*
             * The caution reads as a note, not an error: --graphite like the difficulty note beside
             * it, never --wrong. Nothing has gone wrong — the option works, it just costs something
             * on a small screen, and colouring it as a failure would say the host had made a mistake.
             *
             * The triangle flows with the words rather than sitting in a flex track beside them. As a
             * flex item it was pushed to the far left the moment the sentence wrapped, which read as
             * a stray mark on the page instead of the first thing in a line of prose.
             *
             * Written as .note.caution so it outranks .note's own margin whatever order they end up
             * in — the shorthand there zeroes the inline margins, which is what stopped the block
             * centring the first time.
             */
            .note.caution {
                max-width: 26rem;
                margin: var(--space-2) auto 0;
                text-align: center;
            }

            .note.caution .icon {
                width: 1em;
                height: 1em;
                margin-right: var(--space-1);
                vertical-align: -0.15em;
            }

            fieldset {
                margin: 0 0 var(--space-4);
                padding: 0;
                border: none;
            }

            legend {
                display: block;
                width: 100%;
                margin-bottom: var(--space-2);
                color: var(--graphite);
                font-size: var(--text-sm);
                text-align: center;
            }

            .note {
                margin: var(--space-2) 0 0;
                color: var(--graphite);
                font-size: var(--text-sm);
                font-style: italic;
            }
        `,
    ];

    constructor() {
        super();
        this.spec = null;
        this.disabled = false;
    }

    /** The working selection, falling back to the first of everything before one is supplied. */
    get #current() {
        const type = this.spec?.type ?? PUZZLE_TYPES[0];
        return {
            type,
            difficulty: this.spec?.difficulty ?? DIFFICULTIES[0],
            size: this.spec?.size ?? this.#defaultSize(type),
        };
    }

    /**
     * A type's default grid: its largest *uncautioned* size.
     *
     * Largest, because that is the one people mean by "a sudoku" — but a size the picker turns round
     * and warns about is not one to land the host on by default. Choosing it should be a decision.
     */
    #defaultSize(type) {
        const caution = SIZE_CAUTION[type] ?? null;
        const sides = SIZES_BY_TYPE[type] ?? [];
        const comfortable = caution ? sides.filter((side) => side <= caution.above) : sides;
        const side = (comfortable.length > 0 ? comfortable : sides).at(-1);
        return { rows: side, cols: side };
    }

    /** Applies one field of the spec and announces the whole thing. */
    #choose(patch) {
        const spec = { ...this.#current, ...patch };
        this.spec = spec;
        this.dispatchEvent(
            new CustomEvent('pt-spec-change', { detail: { spec }, bubbles: true, composed: true }),
        );
    }

    render() {
        const current = this.#current;
        const sides = SIZES_BY_TYPE[current.type] ?? [];
        // Difficulty can be unanswerable below a certain size — a small sudoku always falls to
        // singles, however hard it is dug — so the picker says so instead of quietly ignoring the
        // request. The floor is per type: kenken and nonogram mean something at every size they
        // offer, so for them this is never true.
        const floor = DIFFICULTY_MIN_SIDE[current.type] ?? 0;
        const canRate = current.size.rows >= floor;

        // A size can be playable and still be a poor idea on a phone. The option stays available —
        // the host may well be on a laptop — but says so, on the button and again once it is picked.
        const caution = SIZE_CAUTION[current.type] ?? null;
        const isCautioned = (side) => caution != null && side > caution.above;

        return html`
            ${PUZZLE_TYPES.length > 1 ? this.#renderTypes(current) : nothing}
            <fieldset>
                <legend>Size</legend>
                <div class="options">
                    ${sides.map((side) =>
                        this.#renderOption({
                            label: `${side}×${side}`,
                            isChosen: current.size.rows === side,
                            // The triangle alone says only that *something* is wrong, so the caution
                            // rides in the button's name too (brand.md §4).
                            icon: isCautioned(side) ? warningIcon : null,
                            ariaLabel: isCautioned(side)
                                ? `${side}×${side}, ${caution.message}`
                                : null,
                            onPick: () => this.#choose({ size: { rows: side, cols: side } }),
                        }),
                    )}
                </div>
                ${
                    isCautioned(current.size.rows)
                        ? html`<p class="note caution">${warningIcon} ${caution.message}</p>`
                        : nothing
                }
            </fieldset>
            <fieldset>
                <legend>Difficulty</legend>
                <div class="options">
                    ${DIFFICULTIES.map((difficulty) =>
                        this.#renderOption({
                            label: titleCase(difficulty),
                            isChosen: canRate && current.difficulty === difficulty,
                            isDisabled: !canRate,
                            onPick: () => this.#choose({ difficulty }),
                        }),
                    )}
                </div>
                ${
                    canRate
                        ? nothing
                        : html`<p class="note">grids below ${floor}×${floor} are always easy</p>`
                }
            </fieldset>
        `;
    }

    /** The puzzle-type row, which only earns its space once there is more than one type. */
    #renderTypes(current) {
        return html`
            <fieldset>
                <legend>Puzzle</legend>
                <div class="options">
                    ${PUZZLE_TYPES.map((type) =>
                        this.#renderOption({
                            label: PUZZLE_TYPE_NAMES[type] ?? titleCase(type),
                            isChosen: current.type === type,
                            // A size from the old type may not exist on the new one, so switching
                            // type resets the size to that type's largest rather than carrying an
                            // impossible request over — a 9×9 nonogram is not on offer.
                            onPick: () => this.#choose({ type, size: this.#defaultSize(type) }),
                        }),
                    )}
                </div>
            </fieldset>
        `;
    }

    /** One option. `aria-pressed` carries the state the accent wash shows visually. */
    #renderOption({ label, isChosen, isDisabled = false, icon = null, ariaLabel = null, onPick }) {
        return html`
            <button
                type="button"
                class="option"
                aria-pressed=${isChosen}
                aria-label=${ariaLabel ?? nothing}
                ?disabled=${this.disabled || isDisabled}
                @click=${onPick}
            >
                ${icon ?? nothing}${label}
            </button>
        `;
    }
}

customElements.define('pt-puzzle-picker', PtPuzzlePicker);
