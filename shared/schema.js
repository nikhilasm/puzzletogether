/**
 * Runtime validation for every inbound socket payload.
 *
 * Static types describe what *should* arrive; this checks what does (ADR-0006). Shape only —
 * authority (`playerId === room.hostId`) is a separate, later step.
 */

import { DIFFICULTIES, MAX_NAME_LENGTH, PUZZLE_TYPES, ROOM_CODE_LENGTH } from './constants.js';
import { CLIENT_EVENT, OP_TYPE } from './protocol.js';

/** Largest grid this build accepts, which also bounds every cell index. */
const MAX_CELLS = 25 * 25;

/**
 * Builds a validator for a string field, with optional length and pattern bounds.
 *
 * @param {object} [options] - Bounds for the field.
 * @param {number} [options.min] - Minimum length.
 * @param {number} [options.max] - Maximum length.
 * @param {RegExp|null} [options.pattern] - Pattern the value must match.
 * @param {boolean} [options.optional] - Whether the field may be absent.
 * @returns {(value: any, key: string) => string|null} A validator returning an error or null.
 */
function string({ min = 1, max = 200, pattern = null, optional = false } = {}) {
    return (value, key) => {
        if (value == null) return optional ? null : `${key} is required`;
        if (typeof value !== 'string') return `${key} must be a string`;
        if (value.length < min || value.length > max) {
            return `${key} must be ${min}-${max} characters`;
        }
        if (pattern && !pattern.test(value)) return `${key} has an invalid format`;
        return null;
    };
}

/** Builds a validator for a whole-number field within an inclusive range. */
function integer({ min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
    return (value, key) => {
        if (value == null) return optional ? null : `${key} is required`;
        if (!Number.isInteger(value)) return `${key} must be an integer`;
        if (value < min || value > max) return `${key} must be between ${min} and ${max}`;
        return null;
    };
}

/** Builds a validator restricting a field to a fixed set of allowed values. */
function oneOf(allowed, { optional = false } = {}) {
    return (value, key) => {
        if (value == null) return optional ? null : `${key} is required`;
        if (!allowed.includes(value)) return `${key} must be one of: ${allowed.join(', ')}`;
        return null;
    };
}

/** Builds a validator for an array of bounded integers, used for cell lists and pencil marks. */
function integerArray({ maxLength = MAX_CELLS, min = 0, max = MAX_CELLS, optional = false } = {}) {
    return (value, key) => {
        if (value == null) return optional ? null : `${key} is required`;
        if (!Array.isArray(value)) return `${key} must be an array`;
        if (value.length > maxLength) return `${key} may hold at most ${maxLength} entries`;
        for (const entry of value) {
            if (!Number.isInteger(entry) || entry < min || entry > max) {
                return `${key} must hold integers between ${min} and ${max}`;
            }
        }
        return null;
    };
}

/** Builds a validator for a cell value: a single character, or null to clear the cell. */
function cellValue({ optional = false } = {}) {
    return (value, key) => {
        if (value === null) return null;
        if (value === undefined) return optional ? null : `${key} is required`;
        if (typeof value !== 'string' || value.length !== 1) {
            return `${key} must be a single character or null`;
        }
        return null;
    };
}

/** Per-op-type field requirements, applied on top of the common `opId`/`t` check. */
const OP_FIELDS = {
    [OP_TYPE.SET]: { cell: integer({ max: MAX_CELLS - 1 }), value: cellValue() },
    [OP_TYPE.MARKS]: {
        cell: integer({ max: MAX_CELLS - 1 }),
        marks: integerArray({ maxLength: 25, min: 1, max: 25 }),
    },
    [OP_TYPE.CLEAR]: { cell: integer({ max: MAX_CELLS - 1 }) },
    [OP_TYPE.FILL]: {
        cells: integerArray({ max: MAX_CELLS - 1 }),
        value: cellValue(),
    },
};

/** Validates an op's shape, branching on its type. Does not check it against the puzzle. */
function opShape(value, key) {
    if (value == null || typeof value !== 'object') return `${key} must be an object`;
    const idError = string({ min: 1, max: 64 })(value.opId, `${key}.opId`);
    if (idError) return idError;
    const typeError = oneOf(Object.values(OP_TYPE))(value.t, `${key}.t`);
    if (typeError) return typeError;
    return checkFields(value, OP_FIELDS[value.t], key);
}

/** Validates a `{ rows, cols }` grid size. */
function gridSize(value, key) {
    if (value == null || typeof value !== 'object') return `${key} must be an object`;
    return (
        integer({ min: 1, max: 25 })(value.rows, `${key}.rows`) ||
        integer({ min: 1, max: 25 })(value.cols, `${key}.cols`)
    );
}

/** One entry per client-to-server event. An event absent from this map is rejected outright. */
export const SCHEMAS = {
    [CLIENT_EVENT.ROOM_CREATE]: {
        name: string({ max: MAX_NAME_LENGTH }),
    },
    [CLIENT_EVENT.ROOM_JOIN]: {
        name: string({ max: MAX_NAME_LENGTH }),
        code: string({
            min: ROOM_CODE_LENGTH,
            max: ROOM_CODE_LENGTH,
            pattern: /^[a-z]+$/,
        }),
    },
    [CLIENT_EVENT.ROOM_LEAVE]: {},
    [CLIENT_EVENT.GAME_START]: {
        type: oneOf(PUZZLE_TYPES),
        difficulty: oneOf(DIFFICULTIES),
        size: gridSize,
    },
    [CLIENT_EVENT.GAME_OP]: {
        op: opShape,
    },
    [CLIENT_EVENT.GAME_FOCUS]: {
        cell: integer({ max: MAX_CELLS - 1, optional: true }),
    },
    [CLIENT_EVENT.SYNC_REQUEST]: {},
};

/** Runs each field validator in a shape against a payload, returning the first error found. */
function checkFields(payload, fields, prefix) {
    for (const [key, check] of Object.entries(fields)) {
        const error = check(payload[key], prefix ? `${prefix}.${key}` : key);
        if (error) return error;
    }
    return null;
}

/**
 * Validates an inbound payload against the schema for its event.
 *
 * @param {string} event - The client-to-server event name.
 * @param {any} payload - The raw payload as received from the socket.
 * @returns {{ ok: boolean, message?: string }} `ok: true`, or the first validation failure.
 */
export function validate(event, payload) {
    const fields = SCHEMAS[event];
    if (!fields) return { ok: false, message: `unknown event: ${event}` };
    if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, message: 'payload must be an object' };
    }
    const error = checkFields(payload, fields, '');
    return error ? { ok: false, message: error } : { ok: true };
}
