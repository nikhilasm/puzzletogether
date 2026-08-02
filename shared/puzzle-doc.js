/**
 * Helpers for reading a `PuzzleDoc` — index arithmetic and per-cell lookups.
 *
 * Pure and type-agnostic: anything that only makes sense for one puzzle type belongs in that
 * type's module, not here.
 */

/**
 * @typedef {import('./protocol.js').PuzzleDoc} PuzzleDoc
 * @typedef {import('./protocol.js').BoardState} BoardState
 * @typedef {import('./protocol.js').GridSize} GridSize
 */

/**
 * Total number of cells in a grid.
 *
 * @param {GridSize} size - Grid dimensions.
 * @returns {number} `rows * cols`.
 */
export function cellCount(size) {
    return size.rows * size.cols;
}

/**
 * Converts a flat cell index into row and column coordinates.
 *
 * @param {number} idx - Flat, row-major cell index.
 * @param {GridSize} size - Grid dimensions.
 * @returns {{ row: number, col: number }} Zero-based coordinates.
 */
export function toCoords(idx, size) {
    return { row: Math.floor(idx / size.cols), col: idx % size.cols };
}

/**
 * Converts row and column coordinates into a flat cell index.
 *
 * @param {number} row - Zero-based row.
 * @param {number} col - Zero-based column.
 * @param {GridSize} size - Grid dimensions.
 * @returns {number} Flat, row-major cell index.
 */
export function toIndex(row, col, size) {
    return row * size.cols + col;
}

/**
 * Whether a flat index falls inside the grid.
 *
 * @param {number} idx - Flat cell index.
 * @param {GridSize} size - Grid dimensions.
 * @returns {boolean} True when the index addresses a real cell.
 */
export function isInBounds(idx, size) {
    return Number.isInteger(idx) && idx >= 0 && idx < cellCount(size);
}

/**
 * Whether players may write to a cell. Givens and structural blocks are read-only.
 *
 * @param {PuzzleDoc} doc - The puzzle document.
 * @param {number} idx - Flat cell index.
 * @returns {boolean} True when the cell accepts ops.
 */
export function isEditable(doc, idx) {
    if (!isInBounds(idx, doc.size)) return false;
    const cell = doc.cells[idx];
    return !cell.block && cell.given == null;
}

/**
 * The value shown in a cell: the puzzle's given if there is one, otherwise what players entered.
 *
 * @param {PuzzleDoc} doc - The puzzle document.
 * @param {BoardState} board - Current board state.
 * @param {number} idx - Flat cell index.
 * @returns {string|null} The effective value, or null when the cell is empty.
 */
export function effectiveValue(doc, board, idx) {
    const given = doc.cells[idx]?.given;
    if (given != null) return given;
    return board.cells[idx]?.value ?? null;
}

/**
 * Every cell's effective value in row-major order, which is the form solvers and completion
 * checks want.
 *
 * @param {PuzzleDoc} doc - The puzzle document.
 * @param {BoardState} board - Current board state.
 * @returns {(string|null)[]} One entry per cell.
 */
export function effectiveValues(doc, board) {
    const total = cellCount(doc.size);
    const values = new Array(total);
    for (let idx = 0; idx < total; idx += 1) {
        values[idx] = effectiveValue(doc, board, idx);
    }
    return values;
}
