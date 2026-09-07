/**
 * What each puzzle type is and how it is solved, in the one fixed shape every type states it in:
 * goal, rules, and the one setting this type puts beside the keys (design-spec.md §4). A second
 * per-type entry rather than a field on the board registry, since prose about kakuro runs is not how
 * a type is drawn.
 */

/** The three types typed the same way say the same thing about it. */
const NOTES =
    'Notes turns a key press into a small pencil mark rather than an answer, for the digits a square could still hold. On a keyboard, press N to switch it on or off.';

/** Goal, rules, and the type's one setting, per puzzle type. */
export const HELP = {
    sudoku: {
        goal: 'Fill every empty square so that no digit repeats in any row, column, or block.',
        rules: [
            'Each row holds every digit exactly once.',
            'Each column holds every digit exactly once.',
            'Each heavily outlined block holds every digit exactly once.',
        ],
        input: NOTES,
    },
    kenken: {
        goal: 'Fill the grid so that no digit repeats in a row or column and every cage reaches its target.',
        rules: [
            'Each row and each column holds every digit exactly once.',
            'A cage is a heavily outlined group of squares, with its target and operation printed in the corner of its first square.',
            'The digits in a cage combine with that operation, in any order, to make the target.',
            'A digit may repeat within a cage, so long as the row and column rules still hold.',
        ],
        input: NOTES,
    },
    nonogram: {
        goal: 'Fill the squares the numbers describe, and a picture comes out of the grid.',
        rules: [
            'The numbers beside a row or above a column give the lengths of its filled runs, in order.',
            'Consecutive runs are separated by at least one empty square.',
            'A line clued 0 is empty from end to end.',
        ],
        input: 'Fill, Cross, and Erase choose what a tap draws, and dragging paints a whole run at once. A cross is your own note that a square is empty; it is never graded and never counts against a finished grid.',
    },
    kakuro: {
        goal: 'Fill every white square with a digit so that each run of them adds up to its clue.',
        rules: [
            'A clue square is split by a diagonal: the number above the line is the sum of the run to its right, and the number below it is the sum of the run beneath it.',
            'A run is the unbroken line of white squares that follows a clue.',
            'Runs use the digits 1 to 9, and no digit repeats within one run.',
        ],
        input: NOTES,
    },
    crossword: {
        goal: 'Fill the white squares so that every answer matches its clue.',
        rules: [
            'A numbered square starts an Across answer, a Down answer, or both.',
            'Answers cross, so every letter you are sure of narrows two entries at once.',
        ],
        input: 'The clue for the square you are in sits above the keys, and Clues opens the whole list. Rebus holds the cursor still so one square can take a whole word.',
    },
    suguru: {
        goal: 'Fill every square so that each heavily outlined region holds every digit from 1 to its own size exactly once.',
        rules: [
            'A region of 4 squares uses the digits 1 to 4; a region of 6 uses 1 to 6.',
            'The same digit may never sit in two touching squares, including diagonally.',
            'There is no row or column rule: a square is constrained only by its own region and its neighbors.',
        ],
        input: NOTES,
    },
};

/**
 * The help entry for a puzzle type, or null for a type that has none. Null rather than a throw,
 * unlike boardFor, since a build missing this can still be played.
 *
 * @param {string} type - The doc.type of the puzzle being explained.
 * @returns {{ goal: string, rules: string[], input: string } | null} Its help, if it has any.
 */
export function helpFor(type) {
    return HELP[type] ?? null;
}
