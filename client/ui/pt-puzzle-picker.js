/**
 * The puzzle pickers, shared by Puzzle Select and the congrats modal.
 *
 * One component in both places so "start another" offers exactly the choices Puzzle Select does,
 * defaulted to the puzzle just finished (design-spec.md §4).
 *
 * **It has two shapes, and which one it takes follows the provider rather than the puzzle type**
 * (ADR-0009). A generated type is described: pick a size, pick a difficulty, and the generator
 * makes something to match. A banked type is *browsed*: its content is a finite list of particular
 * crosswords with titles and authors, and describing one would be asking the host to guess at a list
 * they could simply be shown.
 *
 * A browsed list can also be **filtered**, by the same two facts a generated type is described by.
 * That is not the question coming back: nothing here asks the host to specify a puzzle that might
 * not exist, it only narrows the list of ones that do. Each filter row appears once there is more
 * than one value behind it, so a bank of four minis still shows a list and nothing else.
 *
 * Holds the working selection as its own state and reports it on every change; the screen around it
 * decides when to turn that into a game:start.
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
         * What the server can actually serve, per type, from the join ack.
         *
         * A generator can make any size it offers, which a constant could state; a bank offers
         * whatever files it was given, which none can. So availability comes from the server and
         * SIZES_BY_TYPE is only the fallback for a client that somehow has no catalog yet.
         */
        catalog: { type: Object },
        /**
         * Which slice of a banked type's list is on show, or null for all of it.
         *
         * State rather than part of the spec: a filter is a way of looking at the bank, not a
         * request travelling to the server. Nothing outside this component needs to know one is on.
         */
        sizeFilter: { state: true },
        difficultyFilter: { state: true },
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
             * it, never --wrong. Nothing has gone wrong: the option works, it just costs something
             * on a small screen, and colouring it as a failure would say the host had made a mistake.
             *
             * The triangle flows with the words rather than sitting in a flex track beside them. As a
             * flex item it was pushed to the far left the moment the sentence wrapped, which read as
             * a stray mark on the page instead of the first thing in a line of prose.
             *
             * Written as .note.caution so it outranks .note's own margin whatever order they end up
             * in; the shorthand there zeroes the inline margins, which is what stops the block
             * centring.
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

            /*
             * A row of options is comfortable at a reading measure and centres in whatever width it
             * is given, so the picker can be handed the whole column without the short rows
             * sprawling across it. 28rem rather than 26 for one reason: it is where the four puzzle
             * types stop wrapping, and Crossword alone on a second line read as a different kind of
             * choice from the other three.
             */
            fieldset {
                max-width: 28rem;
                margin: 0 auto var(--space-4);
                padding: 0;
                border: none;
            }

            /*
             * The list is the exception, and it is why the picker is given the column in the first
             * place. Everything else here is glanced at; this is read: a title, whoever set it, and
             * where it came from, on one line each. At 26rem the second line wrapped under any real
             * newspaper credit and the cards stopped scanning as a column of titles.
             */
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

            /*
             * The browsable list a banked type gets instead of size and difficulty rows.
             *
             * It scrolls rather than growing, because a bank is meant to hold hundreds and a screen
             * that grows with it stops being a screen. The height is in rem so it shows the same
             * number of cards whatever the viewport: about four and a half, so the cut card says
             * plainly that there is more below without needing a scrollbar to be visible.
             */
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

            /* Chosen is the same accent wash every other option in the app uses (brand.md §3). */
            .card[aria-pressed='true'] {
                border-color: var(--accent);
                background: color-mix(in srgb, var(--accent) 16%, transparent);
            }

            .card .title {
                font-weight: 700;
            }

            /*
             * Author and source on one quiet line. They are how a solver tells two 15×15s apart, so
             * they have to be there, but the title is what is being chosen, so they are --graphite
             * and a step down rather than competing with it.
             */
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
     * The types on offer: those the server has something behind.
     *
     * **A type with nothing behind it is left out entirely.** For crossword that is the ordinary
     * state of a build with no licensed bank rather than an error, and offering a button that fails
     * when pressed would be worse than offering three (design-spec.md §7).
     */
    get #types() {
        return PUZZLE_TYPES.filter((type) => this.#sizesFor(type).length > 0);
    }

    /** The difficulties a type offers, which for a bank is what its files happen to carry. */
    #difficultiesFor(type) {
        return this.catalog?.[type]?.difficulties ?? DIFFICULTIES;
    }

    /**
     * The particular puzzles a type offers, when it has any.
     *
     * Only a banked type does. Its presence is the whole branch this component makes: a list means
     * "choose one of these", its absence means "describe what you want" (ADR-0009).
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
        // A banked type's whole selection comes off one card, so the fallback is the first card
        // rather than three independent defaults that might not name any puzzle that exists, and
        // the first *visible* card, so filtering the chosen one away moves the selection with it
        // rather than leaving Start pointed at a puzzle that is no longer on screen.
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
     * A type's default grid: its largest *uncautioned* size.
     *
     * Largest, because that is the one people mean by "a sudoku", but a size the picker turns round
     * and warns about is not one to land the host on by default. Choosing it should be a decision.
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
     * Publishes the resolved selection whenever it differs from the one handed in.
     *
     * The screens around this hold the spec and hand it back, and their opening value is the room's
     * last settings, which for a banked type name a size and a difficulty but no *puzzle*. Left
     * alone, the list would show a card as chosen while the Start button still carried "any 5×5",
     * and pressing it could begin a different crossword than the one highlighted. So the default the
     * list resolves to is announced rather than kept privately.
     *
     * It converges after one pass: what it emits is what #current reads back.
     */
    updated() {
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

    /** Applies one field of the spec and announces the whole thing. */
    #choose(patch) {
        const spec = { ...this.#current, ...patch };
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
     * A banked type's puzzles, as a scrolling list of cards.
     *
     * Each card carries what tells one crossword from another before you have solved it: its title,
     * who set it, where it came from, and how big it is. Nothing here is a *description* of a
     * puzzle: the host is choosing a particular one, and the whole spec comes off the card they
     * press.
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
     * The size and difficulty filters over a banked type's list.
     *
     * **A row appears only when it has more than one thing to choose between**, which is the same
     * rule the puzzle-type row follows. It is also the answer to the objection that had these
     * deferred in ADR-0009: a filter over a bank of four minis, all 5×5 and all easy, is pure
     * clutter, so on that bank neither row is drawn, and the list is still the only thing on screen.
     *
     * **An option that would empty the list is disabled rather than hidden**, shown greyed the way a
     * colour another player holds is. That is not only manners: it is what guarantees the list is
     * never empty. A pressable option is one with something behind it *given the other filter's
     * current value*, so every reachable pair matches at least one puzzle, and the card list can
     * never come up blank with Start still pointed at whatever was last selected.
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

    /** The puzzle-type row, which only earns its space once there is more than one type. */
    #renderTypes(current) {
        return html`
            <fieldset>
                <legend>Puzzle</legend>
                <div class="options">
                    ${this.#types.map((type) =>
                        this.#renderOption({
                            label: PUZZLE_TYPE_NAMES[type] ?? titleCase(type),
                            isChosen: current.type === type,
                            // Switching type starts that type's selection over rather than carrying
                            // anything across, because almost nothing survives the trip: a 9×9
                            // nonogram is not on offer, a bank has only the difficulties its files
                            // happen to carry, and a puzzle id from one type names nothing in
                            // another. #current supplies the new type's own default either way.
                            // The filters go with it, for the same reason: they narrow one type's
                            // list, and holding them across would hide most of the next one.
                            onPick: () => {
                                this.sizeFilter = null;
                                this.difficultyFilter = null;
                                this.#chooseWhole(this.#defaultSpec(type));
                            },
                        }),
                    )}
                </div>
            </fieldset>
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
