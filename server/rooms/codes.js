/**
 * Room code generation.
 *
 * Four characters from a 24-letter alphabet is ~330k combinations: plenty for concurrent rooms,
 * small enough that collision checking is mandatory. The prototype's version tested
 * code in Object.keys(rooms), which checks array *indices* and so never detected a collision
 * (design-spec.md §9).
 */

import { randomInt } from 'node:crypto';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../shared/constants.js';

/** How many codes to try before admitting the space is too crowded. */
const MAX_TRIES = 500;

/** Draws one random code from the unambiguous alphabet. */
function randomCode() {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
    }
    return code;
}

/**
 * Generates a room code that is not already in use.
 *
 * @param {(code: string) => boolean} isTaken - Predicate answering whether a code is in use.
 * @returns {string} An unused 4-character room code.
 * @throws {Error} If no free code is found, which means the server is holding far too many rooms.
 */
export function generateRoomCode(isTaken) {
    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
        const code = randomCode();
        if (!isTaken(code)) return code;
    }
    throw new Error('could not find an unused room code');
}
