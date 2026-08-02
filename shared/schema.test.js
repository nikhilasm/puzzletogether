import { describe, expect, it } from 'vitest';

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

    it('rejects a multi-character cell value', () => {
        const op = { opId: 'x', t: OP_TYPE.SET, cell: 0, value: '55' };
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
        const payload = { type: 'crossword', difficulty: 'easy', size: { rows: 9, cols: 9 } };
        expect(validate(CLIENT_EVENT.GAME_START, payload).ok).toBe(false);
    });

    it('rejects a grid larger than the client can render', () => {
        const payload = { type: 'sudoku', difficulty: 'easy', size: { rows: 99, cols: 99 } };
        expect(validate(CLIENT_EVENT.GAME_START, payload).ok).toBe(false);
    });

    it('treats focus with no cell as valid, since that is how focus is released', () => {
        expect(validate(CLIENT_EVENT.GAME_FOCUS, {}).ok).toBe(true);
    });
});
