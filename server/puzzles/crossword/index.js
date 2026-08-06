/**
 * The crossword puzzle module — and the first type that does not generate anything.
 *
 * **This is where the four-method interface turns out to be two interfaces.** `create` produces a
 * puzzle; `validateOp`, `isComplete`, and `checkCells` rule on one. Three types needed both because
 * they make their own puzzles, so the distinction never had to be drawn. A crossword's clues are
 * written by a person (ADR-0004), so there is nothing here to generate — the puzzle arrives from
 * `bank.js`, and this module supplies only the rules. `provider.js` is what knows which of the two
 * producers a type has, which is exactly the seam it was built to be.
 *
 * The rules themselves are almost entirely borrowed. A crossword cell holds one value compared
 * against one solution value, which is the sentence `value-grid.js` already says for sudoku and
 * kenken — a letter is not different from a digit in any way those functions can see. What is
 * genuinely crossword's is one method: what may be written into a square.
 */

import { MAX_CELL_VALUE_LENGTH } from '../../../shared/constants.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { isEditable } from '../../../shared/puzzle-doc.js';
import { checkCellsByValue, isCompleteByValue } from '../value-grid.js';

/** Document schema version for crossword docs, bumped if the shape of `meta` ever changes. */
export const DOC_VERSION = 1;

/**
 * The letters a crossword square may hold.
 *
 * Carried in each document's `meta` as well, like sudoku's digits, so the board reads what *this*
 * puzzle uses rather than knowing what crosswords use. Uppercase throughout: `.puz` stores solutions
 * uppercase, and a grid where `a` and `A` are different answers would be a grid nobody could solve.
 */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default {
    type: 'crossword',

    /**
     * Whether an op is legal against this document.
     *
     * **The length bound is this module's own, and it is load-bearing.** `schema.js` admits up to
     * `MAX_CELL_VALUE_LENGTH` characters so that rebus squares can exist at all (ADR-0007); which
     * puzzles may actually use that room is decided here, one type at a time. Crossword is the type
     * that wanted it, so crossword is the type that takes it.
     *
     * No pencil marks and no batched fill. A crossword square holds a letter or a word, and the
     * "note" a solver wants — this answer is uncertain — has no rendering in this app; leaving the
     * op unsupported is more honest than accepting marks nothing ever draws.
     *
     * @param {import('../../../shared/protocol.js').PuzzleDoc} doc - The puzzle document.
     * @param {import('../../../shared/protocol.js').Op} op - A schema-validated op.
     * @returns {boolean} True when the server may apply the op.
     */
    validateOp(doc, op) {
        if (op.t === OP_TYPE.FILL || op.t === OP_TYPE.MARKS) return false;
        if (!isEditable(doc, op.cell)) return false;

        if (op.t === OP_TYPE.SET) {
            const value = op.value;
            if (typeof value !== 'string') return false;
            if (value.length < 1 || value.length > MAX_CELL_VALUE_LENGTH) return false;
            const alphabet = doc.meta?.alphabet ?? ALPHABET;
            return [...value].every((letter) => alphabet.includes(letter));
        }

        return true;
    },

    isComplete: isCompleteByValue,
    checkCells: checkCellsByValue,
};
