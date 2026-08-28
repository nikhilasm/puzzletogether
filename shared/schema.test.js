import { describe, expect, it } from 'vitest';

import { MAX_CELL_VALUE_LENGTH, PLAYER_COLOR_COUNT } from './constants.js';
import { CLIENT_EVENT, OP_TYPE } from './protocol.js';
import { validate } from './schema.js';

describe('validate', () => {
    it('accepts a well-formed join', () => {
        const result = validate(CLIENT_EVENT.ROOM_JOIN, { name: 'Nik', code: 'kqjy' });
        expect(result.ok).toBe(true);
    });

    it('rejects an unknown event rather than letting it through', () => {
        expect(validate('room:destroyEverything', {}).ok).toBe(false);
    });

    it.each([
        ['null payload', null],
        ['an array', []],
        ['a string', 'kqjy'],
    ])('rejects %s', (_label, payload) => {
        expect(validate(CLIENT_EVENT.ROOM_JOIN, payload).ok).toBe(false);
    });

    it('rejects a room code of the wrong length', () => {
        expect(validate(CLIENT_EVENT.ROOM_JOIN, { name: 'Nik', code: 'kq' }).ok).toBe(false);
    });

    it('rejects a room code with characters outside the alphabet', () => {
        expect(validate(CLIENT_EVENT.ROOM_JOIN, { name: 'Nik', code: 'KQ1Y' }).ok).toBe(false);
    });

    it('rejects an empty name', () => {
        expect(validate(CLIENT_EVENT.ROOM_JOIN, { name: '', code: 'kqjy' }).ok).toBe(false);
    });

    it('accepts a set op', () => {
        const op = { opId: 'c4f1-7', t: OP_TYPE.SET, cell: 42, value: '5' };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(true);
    });

    it('rejects an op with an unknown type', () => {
        const op = { opId: 'x', t: 'delete-everything', cell: 0 };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    /**
     * A multi-character value is a crossword rebus square, which the schema bounds rather than
     * refuses (ADR-0007). This file's job is the wire; whether a given puzzle may hold HAND in a
     * cell belongs to that type's validateOp, where sudoku and kenken are tested to still say no.
     */
    it('accepts a multi-character cell value, which is a rebus square', () => {
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 0, value: 'HAND' };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(true);
    });

    it('accepts a cell value of exactly the maximum length', () => {
        const value = 'A'.repeat(MAX_CELL_VALUE_LENGTH);
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 0, value };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(true);
    });

    it('rejects a cell value past the maximum length', () => {
        const value = 'A'.repeat(MAX_CELL_VALUE_LENGTH + 1);
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 0, value };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it('rejects an empty cell value: null is how a cell is emptied, not the empty string', () => {
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 0, value: '' };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it('rejects a cell index outside any supported grid', () => {
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 999_999, value: '5' };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it('rejects a negative cell index', () => {
        const op = { opId: 'x', t: OP_TYPE.SET, cell: -1, value: '5' };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it('rejects a fill op carrying more cells than a grid can hold', () => {
        const op = {
            opId: 'x',
            t: OP_TYPE.FILL,
            cells: Array.from({ length: 5000 }, (_unused, i) => i),
            value: 'x',
        };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it('accepts a null value, which is how a cell is emptied', () => {
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 0, value: null };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(true);
    });

    it('rejects a start request for an unsupported puzzle type', () => {
        const payload = { type: 'wordsearch', difficulty: 'easy', size: { rows: 9, cols: 9 } };
        expect(validate(CLIENT_EVENT.GAME_START, payload).ok).toBe(false);
    });

    it('accepts crossword, which the build now serves', () => {
        const payload = { type: 'crossword', difficulty: 'easy', size: { rows: 15, cols: 15 } };
        expect(validate(CLIENT_EVENT.GAME_START, payload).ok).toBe(true);
    });

    /** Real crosswords are not square. 20×21 is an ordinary Sunday-size grid. */
    it('accepts a grid that is not square', () => {
        const payload = { type: 'crossword', difficulty: 'hard', size: { rows: 21, cols: 20 } };
        expect(validate(CLIENT_EVENT.GAME_START, payload).ok).toBe(true);
    });

    it('rejects a grid larger than the client can render', () => {
        const payload = { type: 'sudoku', difficulty: 'easy', size: { rows: 99, cols: 99 } };
        expect(validate(CLIENT_EVENT.GAME_START, payload).ok).toBe(false);
    });

    it('treats focus with no cell as valid, since that is how focus is released', () => {
        expect(validate(CLIENT_EVENT.GAME_FOCUS, {}).ok).toBe(true);
    });

    it('accepts a marks op', () => {
        const op = { opId: 'x', t: OP_TYPE.MARKS, cell: 4, marks: [1, 3, 7] };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(true);
    });

    it('rejects a mark outside any grid alphabet', () => {
        const op = { opId: 'x', t: OP_TYPE.MARKS, cell: 4, marks: [99] };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it('rejects non-integer marks', () => {
        const op = { opId: 'x', t: OP_TYPE.MARKS, cell: 4, marks: ['3'] };
        expect(validate(CLIENT_EVENT.GAME_OP, { op }).ok).toBe(false);
    });

    it.each([
        ['check', CLIENT_EVENT.GAME_CHECK],
        ['reveal', CLIENT_EVENT.GAME_REVEAL],
        ['back to select', CLIENT_EVENT.ROOM_BACK_TO_SELECT],
    ])('accepts an empty %s payload', (_label, event) => {
        expect(validate(event, {}).ok).toBe(true);
    });

    it('ignores a cell list smuggled into check, since check has no cell-scoped form', () => {
        // A well-formed payload with extra keys is accepted and the extras are never read. The
        // server grades the whole grid, so a client cannot use Check to probe one cell at a time.
        expect(validate(CLIENT_EVENT.GAME_CHECK, { cells: [0, 1, 2] }).ok).toBe(true);
    });

    it('rejects a check payload that is not an object at all', () => {
        expect(validate(CLIENT_EVENT.GAME_CHECK, null).ok).toBe(false);
    });

    it('accepts a kick naming a player', () => {
        expect(validate(CLIENT_EVENT.ROOM_KICK, { playerId: 'a-uuid' }).ok).toBe(true);
    });

    it.each([
        ['no player at all', {}],
        ['an empty player id', { playerId: '' }],
        ['a player id that is not a string', { playerId: 7 }],
        ['a player id longer than any the server issues', { playerId: 'x'.repeat(65) }],
    ])('rejects a kick with %s', (_label, payload) => {
        expect(validate(CLIENT_EVENT.ROOM_KICK, payload).ok).toBe(false);
    });

    it('accepts a colour change inside the palette', () => {
        expect(validate(CLIENT_EVENT.PLAYER_COLOR, { colorIndex: 0 }).ok).toBe(true);
        expect(validate(CLIENT_EVENT.PLAYER_COLOR, { colorIndex: PLAYER_COLOR_COUNT - 1 }).ok).toBe(
            true,
        );
    });

    it.each([
        ['past the end of the palette', { colorIndex: PLAYER_COLOR_COUNT }],
        ['negative', { colorIndex: -1 }],
        ['fractional', { colorIndex: 1.5 }],
        ['a colour name rather than an index', { colorIndex: 'teal' }],
        ['absent', {}],
    ])('rejects a colour index that is %s', (_label, payload) => {
        expect(validate(CLIENT_EVENT.PLAYER_COLOR, payload).ok).toBe(false);
    });

    it('ignores a player id smuggled into a colour change', () => {
        // Extras are never read: the handler recolours the caller's own seat, so there is no way
        // to phrase "recolour somebody else" that the server would act on.
        expect(
            validate(CLIENT_EVENT.PLAYER_COLOR, { colorIndex: 2, playerId: 'someone-else' }).ok,
        ).toBe(true);
    });
});
