/**
 * The crossword puzzle module, and the first type that does not generate anything: its puzzles
 * arrive from bank.js (ADR-0004), so this module supplies only the rules. The rules are almost
 * entirely borrowed from value-grid.js, since a letter is no different from a digit to those
 * functions; what is genuinely crossword's is one method, what may be written into a square.
 */

import { MAX_CELL_VALUE_LENGTH } from '../../../shared/constants.js';
import { OP_TYPE } from '../../../shared/protocol.js';
import { isEditable } from '../../../shared/puzzle-doc.js';
import { checkCellsByValue, isCompleteByValue } from '../value-grid.js';

/** Document schema version for crossword docs, bumped if the shape of meta ever changes. */
export const DOC_VERSION = 1;

/**
 * The letters a crossword square may hold, carried in each document's meta as well so the board
 * reads what this puzzle uses. Uppercase throughout, since .puz stores solutions uppercase and a and
 * A must not be different answers.
 */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default {
    type: 'crossword',

    /**
     * Whether an op is legal against this document; the length bound is this module's own, deciding
     * which type uses the rebus room schema.js admits (ADR-0007). No pencil marks and no batched
     * fill, since a crossword's uncertainty note has no rendering in this app.
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
