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
    SIZES_BY_TYPE,
} from '../../shared/constants.js';
import { controls, optionGroup } from '../styles/controls.js';

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
        css`
            :host {
                display: block;
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
        const sides = SIZES_BY_TYPE[type] ?? [];
        return {
            type,
            difficulty: this.spec?.difficulty ?? DIFFICULTIES[0],
            size: this.spec?.size ?? { rows: sides.at(-1), cols: sides.at(-1) },
        };
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
        // Difficulty is unanswerable below a certain size: a small grid always falls to singles,
        // however hard it is dug, so the picker says so instead of quietly ignoring the request.
        const canRate = current.size.rows >= DIFFICULTY_MIN_SIDE;

        return html`
            ${PUZZLE_TYPES.length > 1 ? this.#renderTypes(current) : nothing}
            <fieldset>
                <legend>Size</legend>
                <div class="options">
                    ${sides.map((side) =>
                        this.#renderOption({
                            label: `${side}×${side}`,
                            isChosen: current.size.rows === side,
                            onPick: () => this.#choose({ size: { rows: side, cols: side } }),
                        }),
                    )}
                </div>
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
                        : html`<p class="note">
                              grids below ${DIFFICULTY_MIN_SIDE}×${DIFFICULTY_MIN_SIDE} are always
                              easy
                          </p>`
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
                            label: titleCase(type),
                            isChosen: current.type === type,
                            onPick: () => this.#choose({ type }),
                        }),
                    )}
                </div>
            </fieldset>
        `;
    }

    /** One option. `aria-pressed` carries the state the accent wash shows visually. */
    #renderOption({ label, isChosen, isDisabled = false, onPick }) {
        return html`
            <button
                type="button"
                class="option"
                aria-pressed=${isChosen}
                ?disabled=${this.disabled || isDisabled}
                @click=${onPick}
            >
                ${label}
            </button>
        `;
    }
}

customElements.define('pt-puzzle-picker', PtPuzzlePicker);
