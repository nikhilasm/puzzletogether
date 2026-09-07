/**
 * The puzzle pickers, shared by Puzzle Select and the congrats modal so start another offers
 * exactly the choices Puzzle Select does (design-spec.md §4). It takes two shapes following the
 * provider (ADR-0009): a generated type is described by size and difficulty, a banked type is
 * browsed as a filterable list; it holds the working selection and reports it on every change.
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

import { helpFor } from './help-text.js';
import { iconStyle, puzzleTypeIcons, typeIconStyle, warningIcon } from './icons.js';

/** Sentence-cases a token for display without touching the value that travels over the wire. */
function titleCase(value) {
    return value[0].toUpperCase() + value.slice(1);
}

/** A size as a single comparable token, since the filter cannot hold an object and match on it. */
function sizeKey(size) {
    return `${size.rows}x${size.cols}`;
}

/** How a size is written wherever it is shown: columns first, the way a grid is described. */
function sizeLabel(size) {
    return `${size.cols}×${size.rows}`;
}

export class PtPuzzlePicker extends LitElement {
    static properties = {
        spec: { type: Object },
        disabled: { type: Boolean },
        /**
         * Show only the types this room can play, greyed and unpressable, with no size, difficulty,
         * or list. What a member sees while the host chooses: the options on offer, not a control.
         */
        readonly: { type: Boolean },
        /**
         * What the server can actually serve, per type, from the join ack. A bank offers whatever
         * files it was given, which no constant can state, so availability comes from the server and
         * SIZES_BY_TYPE is only the fallback.
         */
        catalog: { type: Object },
        /**
         * Which slice of a banked type's list is on show, or null for all of it. State rather than
         * part of the spec, since a filter is a way of looking at the bank, not a request to the
         * server.
         */
        sizeFilter: { state: true },
        difficultyFilter: { state: true },
    };

    static styles = [
        controls,
        optionGroup,
        iconStyle,
        typeIconStyle,
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

            /* The puzzle types are a grid of tiles rather than a row of words (ADR-0022), fixed at
               three columns so six do not wrap into two uneven groups; a type not on offer is left
               out, so the last row can be short. */
            .types {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: var(--space-2);
            }

            /* The mark over its word (ADR-0012) so the six tiles stay one width, with box-sizing
               since the reset does not cross the shadow boundary and the min-height must include
               padding and border. */
            .type {
                display: flex;
                box-sizing: border-box;
                flex-direction: column;
                gap: var(--space-2);
                align-items: center;
                justify-content: center;
                min-height: 5.25rem;
                padding: var(--space-3) var(--space-2);
                font-size: var(--text-sm);
            }

            /*
             * A fixed 2rem, not iconStyle's 1.25em, for the reason the panel's controls are fixed:
             * this is a strip of controls rather than an icon inside a sentence, and the picker is
             * drawn at one font size in Puzzle Select and another inside the congrats modal.
             */
            .type .icon {
                width: 2.25rem;
                height: 2.25rem;
            }

            /* The chosen type's mark goes --accent-text via currentColor so the whole drawing moves
               (brand.md §2, §4). */
            .type[aria-pressed='true'] .icon {
                color: var(--accent-text);
            }

            /* Where three columns stop holding a mark and a word like Crossword side by side. */
            @media (max-width: 30rem) {
                .types {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            /* The caution reads as a note in --graphite, never --wrong, with the triangle flowing
               inline rather than in a flex track; written .note.caution so it outranks .note's own
               margin. */
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

            /* A row of options centred at a reading measure of 28rem, the width three type tiles
               need to hold the longest name without wrapping. */
            fieldset {
                max-width: 28rem;
                margin: 0 auto var(--space-4);
                padding: 0;
                border: none;
            }

            /* The list is the exception that gets the full column width, since a card is read rather
               than glanced at and a real credit wrapped at 26rem. */
            fieldset.list {
                max-width: none;
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

            /* What the chosen type asks of a solver, under the row rather than on every button so
               four descriptions do not become a wall of prose; not italic like .note, since this
               answers the row rather than qualifying it. */
            .goal {
                max-width: 26rem;
                margin: var(--space-2) auto 0;
                color: var(--graphite);
                font-size: var(--text-sm);
                line-height: 1.5;
                text-align: center;
            }

            /* The browsable list a banked type gets, scrolling rather than growing since a bank may
               hold hundreds, its rem height showing about four and a half cards so the cut one
               signals more below. */
            .cards {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                max-height: 21rem;
                padding: var(--space-1);
                overflow-y: auto;
                text-align: left;
            }

            .card {
                display: flex;
                gap: var(--space-3);
                align-items: baseline;
                justify-content: space-between;
                width: 100%;
                padding: var(--space-3) var(--space-4);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-base);
                text-align: left;
                cursor: pointer;
            }

            @media (hover: hover) {
                .card:hover:not(:disabled) {
                    border-color: var(--accent);
                }
            }

            /*
             * Chosen is the same accent wash every other option in the app uses (brand.md §3), and
             * mixed into the card's own ground like all of them: over transparent, the page texture
             * showed through the chosen card.
             */
            .card[aria-pressed='true'] {
                border-color: var(--accent);
                background: color-mix(in srgb, var(--accent) 16%, var(--paper-raised));
            }

            .card .title {
                font-weight: 700;
            }

            /* Author and source on one quiet --graphite line, a step down since the title is what is
               being chosen. */
            .card .meta {
                display: block;
                margin-top: var(--space-1);
                color: var(--graphite);
                font-size: var(--text-sm);
                font-weight: 400;
            }

            /*
             * The two facts the filters above narrow on, right-aligned so they form a column the eye
             * can run down rather than trailing off the end of titles of every length.
             */
            .card .facts {
                flex-shrink: 0;
                text-align: right;
            }

            .card .size,
            .card .level {
                display: block;
                color: var(--graphite);
                font-size: var(--text-sm);
                font-weight: 400;
                white-space: nowrap;
            }

            .card .size {
                font-variant-numeric: tabular-nums;
            }

            .empty {
                margin: 0;
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
        this.readonly = false;
        this.catalog = null;
        this.sizeFilter = null;
        this.difficultyFilter = null;
    }

    /**
     * The sizes a type offers, as { rows, cols } pairs.
     *
     * Pairs rather than square sides because a real crossword is 15×15 and 5×5 and also 20×21, and
     * a list of sides cannot say the third one.
     */
    #sizesFor(type) {
        const fromCatalog = this.catalog?.[type]?.sizes;
        if (fromCatalog) return fromCatalog;
        return (SIZES_BY_TYPE[type] ?? []).map((side) => ({ rows: side, cols: side }));
    }

    /**
     * The types on offer: those the server has something behind. A type with nothing behind it is
     * left out, which for crossword is the ordinary state of a build with no bank rather than an
     * error (design-spec.md §7).
     */
    get #types() {
        return PUZZLE_TYPES.filter((type) => this.#sizesFor(type).length > 0);
    }

    /** The difficulties a type offers, which for a bank is what its files happen to carry. */
    #difficultiesFor(type) {
        return this.catalog?.[type]?.difficulties ?? DIFFICULTIES;
    }

    /**
     * The particular puzzles a type offers, when it has any, which only a banked type does. Its
     * presence is the whole branch: a list means choose one of these, its absence means describe
     * what you want (ADR-0009).
     */
    #puzzlesFor(type) {
        return this.catalog?.[type]?.puzzles ?? null;
    }

    /**
     * The puzzles left once a size and a difficulty are applied, either of which may be null for any.
     *
     * Takes the pair as arguments rather than reading the filters, because the filter row also has to
     * ask the hypothetical question: what *would* be left if this option were pressed.
     */
    #matching(puzzles, size, difficulty) {
        return puzzles.filter(
            (puzzle) =>
                (size == null || sizeKey(puzzle.size) === size) &&
                (difficulty == null || puzzle.difficulty === difficulty),
        );
    }

    /** The puzzles currently on show. */
    #visible(puzzles) {
        return this.#matching(puzzles, this.sizeFilter, this.difficultyFilter);
    }

    /** The working selection, falling back to the first of everything before one is supplied. */
    get #current() {
        const type = this.spec?.type ?? this.#types[0] ?? PUZZLE_TYPES[0];
        const banked = this.#puzzlesFor(type);
        // A banked type's whole selection comes off one card, so the fallback is the first visible
        // card, so filtering the chosen one away moves the selection rather than leaving Start
        // pointed off screen.
        if (banked)
            return this.#specFor(type, this.#chosenPuzzle(type) ?? this.#visible(banked)[0]);

        return {
            type,
            difficulty: this.spec?.difficulty ?? this.#difficultiesFor(type)[0],
            size: this.spec?.size ?? this.#defaultSize(type),
        };
    }

    /** A type's opening selection: its first card, or its default size at its first difficulty. */
    #defaultSpec(type) {
        const banked = this.#puzzlesFor(type);
        if (banked) return this.#specFor(type, banked[0]);
        return {
            type,
            difficulty: this.#difficultiesFor(type)[0],
            size: this.#defaultSize(type),
        };
    }

    /** The card currently chosen for a banked type, if the working spec names one that is on show. */
    #chosenPuzzle(type) {
        const id = this.spec?.type === type ? this.spec?.puzzleId : null;
        const puzzles = id ? this.#puzzlesFor(type) : null;
        if (!puzzles) return null;
        return this.#visible(puzzles).find((puzzle) => puzzle.id === id) ?? null;
    }

    /**
     * The spec one card stands for.
     *
     * The size and difficulty travel alongside the id rather than being left for the server to look
     * up, because they are what the *room* records, its settings and what "start another" offers
     * next, and that has to keep working whether the puzzle came from a bank or a generator.
     */
    #specFor(type, puzzle) {
        if (!puzzle) return { type, difficulty: this.#difficultiesFor(type)[0], size: null };
        return {
            type,
            difficulty: puzzle.difficulty,
            size: { ...puzzle.size },
            puzzleId: puzzle.id,
        };
    }

    /**
     * A type's default grid: its largest uncautioned size. Largest is what people mean by a sudoku,
     * but a size the picker warns about should be a decision, not a default.
     */
    #defaultSize(type) {
        const caution = SIZE_CAUTION[type] ?? null;
        const sizes = this.#sizesFor(type);
        const comfortable = caution
            ? sizes.filter((size) => Math.max(size.rows, size.cols) <= caution.above)
            : sizes;
        return (comfortable.length > 0 ? comfortable : sizes).at(-1) ?? { rows: 9, cols: 9 };
    }

    /**
     * Publishes the resolved selection whenever it differs from the one handed in, since the room's
     * last settings name no puzzle for a banked type and the list would otherwise show one card
     * chosen while Start carried another. It converges after one pass, since what it emits is what
     * #current reads back.
     */
    updated() {
        // A readonly picker announces nothing: it holds no working selection to converge on.
        if (this.readonly) return;
        const current = this.#current;
        if (!current.size || this.#sameSpec(current, this.spec)) return;
        this.#chooseWhole(current);
    }

    /** Whether two specs would start the same puzzle. */
    #sameSpec(a, b) {
        return (
            b != null &&
            a.type === b.type &&
            a.difficulty === b.difficulty &&
            (a.puzzleId ?? null) === (b.puzzleId ?? null) &&
            a.size?.rows === b.size?.rows &&
            a.size?.cols === b.size?.cols
        );
    }

    /**
     * A spec whose difficulty is back at the first band wherever difficulty means nothing. Below a
     * type's floor the spec would otherwise keep a difficulty the disabled buttons cannot take back,
     * and the server would burn its redraw budget on a band no small grid can have.
     */
    #rated(spec) {
        const floor = DIFFICULTY_MIN_SIDE[spec.type] ?? 0;
        if (spec.size == null || spec.size.rows >= floor) return spec;
        return { ...spec, difficulty: this.#difficultiesFor(spec.type)[0] };
    }

    /** Applies one field of the spec and announces the whole thing. */
    #choose(patch) {
        const spec = this.#rated({ ...this.#current, ...patch });
        this.spec = spec;
        this.dispatchEvent(
            new CustomEvent('pt-spec-change', { detail: { spec }, bubbles: true, composed: true }),
        );
    }

    /** Replaces the whole selection, which is what picking a card off a bank's list does. */
    #chooseWhole(spec) {
        this.spec = spec;
        this.dispatchEvent(
            new CustomEvent('pt-spec-change', { detail: { spec }, bubbles: true, composed: true }),
        );
    }

    render() {
        if (this.readonly) return this.#renderAvailable();

        const current = this.#current;
        const banked = this.#puzzlesFor(current.type);

        if (banked) {
            return html`
                ${this.#types.length > 1 ? this.#renderTypes(current) : nothing}
                ${this.#renderFilters(banked)} ${this.#renderCards(banked, current)}
            `;
        }

        const sizes = this.#sizesFor(current.type);
        const difficulties = this.#difficultiesFor(current.type);
        // Difficulty can be unanswerable below a certain size: a small sudoku always falls to
        // singles however hard it is dug, so the picker says so instead of quietly ignoring the
        // request. The floor is per type: kenken and nonogram mean something at every size they
        // offer, so for them this is never true.
        const floor = DIFFICULTY_MIN_SIDE[current.type] ?? 0;
        const canRate = current.size.rows >= floor;

        // A size can be playable and still be a poor idea on a phone. The option stays available,
        // since the host may well be on a laptop, but says so on the button and again once picked.
        const caution = SIZE_CAUTION[current.type] ?? null;
        const isCautioned = (size) =>
            caution != null && Math.max(size.rows, size.cols) > caution.above;
        const chosen = (size) => current.size.rows === size.rows && current.size.cols === size.cols;

        return html`
            ${this.#types.length > 1 ? this.#renderTypes(current) : nothing}
            <fieldset>
                <legend>Size</legend>
                <div class="options">
                    ${sizes.map((size) =>
                        this.#renderOption({
                            label: `${size.cols}×${size.rows}`,
                            isChosen: chosen(size),
                            // The triangle alone says only that *something* is wrong, so the caution
                            // rides in the button's name too (brand.md §4).
                            icon: isCautioned(size) ? warningIcon : null,
                            ariaLabel: isCautioned(size)
                                ? `${size.cols}×${size.rows}, ${caution.message}`
                                : null,
                            onPick: () => this.#choose({ size: { ...size } }),
                        }),
                    )}
                </div>
                ${
                    isCautioned(current.size)
                        ? html`<p class="note caution">${warningIcon} ${caution.message}</p>`
                        : nothing
                }
            </fieldset>
            <fieldset>
                <legend>Difficulty</legend>
                <div class="options">
                    ${difficulties.map((difficulty) =>
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

    /**
     * A banked type's puzzles, as a scrolling list of cards. Each carries what tells one crossword
     * from another before solving it: title, author, source, and size, with the whole spec coming
     * off the card pressed.
     */
    #renderCards(puzzles, current) {
        if (puzzles.length === 0) {
            return html`<p class="empty">this build has no puzzles of that kind</p>`;
        }

        // The count appears only once a filter is on, and it is there because the alternative is a
        // list that silently got shorter. It also says how much of the bank is being hidden, which is
        // the thing that tells a host whether it is worth widening the filter back out.
        const visible = this.#visible(puzzles);
        const legend =
            visible.length === puzzles.length
                ? 'Choose a puzzle'
                : `Choose a puzzle · ${visible.length} of ${puzzles.length}`;

        return html`
            <fieldset class="list">
                <legend>${legend}</legend>
                <div class="cards">
                    ${visible.map((puzzle) => this.#renderCard(puzzle, current))}
                </div>
            </fieldset>
        `;
    }

    /**
     * The size and difficulty filters over a banked type's list, each row drawn only when it has
     * more than one value (ADR-0009). An option that would empty the list is disabled rather than
     * hidden, given the other filter's current value, so the card list can never come up blank.
     */
    #renderFilters(puzzles) {
        // Both axes come off the list being filtered rather than off the catalog's own size and
        // difficulty arrays, so a filter can never offer a value with no card behind it.
        const sizes = [...new Map(puzzles.map((puzzle) => [sizeKey(puzzle.size), puzzle.size]))];
        sizes.sort(([, a], [, b]) => a.rows * a.cols - b.rows * b.cols);

        const present = new Set(puzzles.map((puzzle) => puzzle.difficulty));
        // Easy before hard, whatever order the bank's files happened to load in; anything the
        // constant does not know about follows, rather than being dropped from a filter it belongs in.
        const difficulties = [
            ...DIFFICULTIES.filter((difficulty) => present.has(difficulty)),
            ...[...present].filter((difficulty) => !DIFFICULTIES.includes(difficulty)),
        ];

        return html`
            ${
                sizes.length > 1
                    ? html`
                          <fieldset class="filter filter-size">
                              <legend>Filter by size</legend>
                              <div class="options">
                                  ${this.#renderOption({
                                      label: 'Any size',
                                      isChosen: this.sizeFilter == null,
                                      onPick: () => {
                                          this.sizeFilter = null;
                                      },
                                  })}
                                  ${sizes.map(([key, size]) =>
                                      this.#renderOption({
                                          label: sizeLabel(size),
                                          isChosen: this.sizeFilter === key,
                                          isDisabled:
                                              this.#matching(puzzles, key, this.difficultyFilter)
                                                  .length === 0,
                                          onPick: () => {
                                              this.sizeFilter = key;
                                          },
                                      }),
                                  )}
                              </div>
                          </fieldset>
                      `
                    : nothing
            }
            ${
                difficulties.length > 1
                    ? html`
                          <fieldset class="filter filter-difficulty">
                              <legend>Filter by difficulty</legend>
                              <div class="options">
                                  ${this.#renderOption({
                                      label: 'Any difficulty',
                                      isChosen: this.difficultyFilter == null,
                                      onPick: () => {
                                          this.difficultyFilter = null;
                                      },
                                  })}
                                  ${difficulties.map((difficulty) =>
                                      this.#renderOption({
                                          label: titleCase(difficulty),
                                          isChosen: this.difficultyFilter === difficulty,
                                          isDisabled:
                                              this.#matching(puzzles, this.sizeFilter, difficulty)
                                                  .length === 0,
                                          onPick: () => {
                                              this.difficultyFilter = difficulty;
                                          },
                                      }),
                                  )}
                              </div>
                          </fieldset>
                      `
                    : nothing
            }
        `;
    }

    /** One puzzle. aria-pressed carries the state the accent wash shows visually. */
    #renderCard(puzzle, current) {
        // Author and source are both optional, since an imported file may carry neither, so the line is
        // composed from whatever is actually there rather than printing "by null · null".
        const credits = [puzzle.author ? `by ${puzzle.author}` : null, puzzle.source].filter(
            Boolean,
        );
        const size = sizeLabel(puzzle.size);
        // A banked puzzle's difficulty is a fact about it rather than a question put to the host, so
        // the card states it, and it has to now that there is a filter narrowing on it.
        const level = titleCase(puzzle.difficulty);
        const name = puzzle.title ?? puzzle.id;

        return html`
            <button
                type="button"
                class="card"
                aria-pressed=${current.puzzleId === puzzle.id}
                aria-label=${[name, ...credits, size, level].join(', ')}
                ?disabled=${this.disabled}
                @click=${() => this.#chooseWhole(this.#specFor(current.type, puzzle))}
            >
                <span>
                    <span class="title">${name}</span>
                    ${
                        credits.length > 0
                            ? html`<span class="meta">${credits.join(' · ')}</span>`
                            : nothing
                    }
                </span>
                <span class="facts">
                    <span class="size">${size}</span>
                    <span class="level">${level}</span>
                </span>
            </button>
        `;
    }

    /**
     * The puzzles this room can play, for a member watching the host choose: the same type grid,
     * greyed and unpressable. It shows even for a single type, since saying what the puzzle is beats
     * an empty screen (design-spec.md §4).
     */
    #renderAvailable() {
        return html`
            <fieldset>
                <legend>Available puzzles</legend>
                <div class="types">
                    ${this.#types.map((type) => this.#renderReadonlyType(type))}
                </div>
            </fieldset>
        `;
    }

    /** One available type as a static tile: the mark over its name, greyed and never pressed. */
    #renderReadonlyType(type) {
        return html`
            <button type="button" class="option type" aria-pressed="false" disabled>
                ${puzzleTypeIcons[type] ?? nothing}
                <span class="type-label">${PUZZLE_TYPE_NAMES[type] ?? titleCase(type)}</span>
            </button>
        `;
    }

    /**
     * The puzzle-type grid, which only earns its space once there is more than one type. Each type
     * wears a mark of its own board since a name alone does not say what the game is (ADR-0022),
     * with the goal sentence under the grid saying what it asks.
     */
    #renderTypes(current) {
        const goal = helpFor(current.type)?.goal ?? null;

        return html`
            <fieldset>
                <legend>Puzzle</legend>
                <div class="types">
                    ${this.#types.map((type) => this.#renderType(type, current))}
                </div>
                ${goal ? html`<p class="goal">${goal}</p>` : nothing}
            </fieldset>
        `;
    }

    /**
     * One puzzle type: its mark over its name, still an .option so the accent wash is the same
     * paint, the mark aria-hidden with the name in the button (brand.md §4). The name is in its own
     * span, since a mark that prints digits would otherwise put them in the button's textContent.
     */
    #renderType(type, current) {
        return html`
            <button
                type="button"
                class="option type"
                aria-pressed=${current.type === type}
                ?disabled=${this.disabled}
                @click=${() => {
                    // Switching type starts that type's selection over, since almost nothing survives
                    // the trip: a 9×9 nonogram is not on offer, and a puzzle id from one type names
                    // nothing in another. The filters reset too, since they narrow one type's list.
                    this.sizeFilter = null;
                    this.difficultyFilter = null;
                    this.#chooseWhole(this.#defaultSpec(type));
                }}
            >
                ${puzzleTypeIcons[type] ?? nothing}
                <span class="type-label">${PUZZLE_TYPE_NAMES[type] ?? titleCase(type)}</span>
            </button>
        `;
    }

    /** One option. aria-pressed carries the state the accent wash shows visually. */
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
