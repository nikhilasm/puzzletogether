/**
 * What each puzzle type is, and how it is solved, in the one shape every type states it in.
 *
 * Three fields, the same three for every type. goal is the single sentence that says what finishing
 * looks like; rules are the constraints the grid does not print on itself; input names the one
 * setting this type puts beside the keys, which is the only part of the screen that differs between
 * types (design-spec.md §4). Fixed shape is what lets one dialog render any type without a branch,
 * and lets the picker show goal on its own without cutting a sentence in half.
 *
 * A second per-type entry rather than a field on the board registry: registry.js declares how a type
 * is drawn and typed into, and prose about kakuro runs is not that. Adding a type therefore means
 * two entries, which design-spec.md §7 records.
 */

/** The three types typed the same way say the same thing about it. */
const NOTES =
    'Notes turns a key press into a small pencil mark rather than an answer, for the digits a square could still hold.';

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
};

/**
 * The help entry for a puzzle type, or null for a type that has none.
 *
 * Null rather than a throw, unlike boardFor: a build missing a board cannot draw the puzzle at all,
 * while a build missing this can still be played. The screens react by leaving the way in undrawn.
 *
 * @param {string} type - The doc.type of the puzzle being explained.
 * @returns {{ goal: string, rules: string[], input: string } | null} Its help, if it has any.
 */
export function helpFor(type) {
    return HELP[type] ?? null;
}
