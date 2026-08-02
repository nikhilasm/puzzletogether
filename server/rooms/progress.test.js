import { beforeEach, describe, expect, it } from 'vitest';

import { ROOM_STATE } from '../../shared/protocol.js';
import sudoku from '../puzzles/sudoku/index.js';

import { abandonPuzzle, checkPuzzle, revealPuzzle, solvePuzzle } from './progress.js';
import { createRoom } from './store.js';

/** The solution every fixture room is checked against. */
const SOLUTION = ['1', '2', '3', '4'];

/** A 2×2 grid with one given, small enough that every assertion names specific cells. */
function fixtureDoc() {
    return {
        id: 'test-1',
        type: 'sudoku',
        version: 1,
        size: { rows: 2, cols: 2 },
        difficulty: 'easy',
        title: null,
        author: null,
        source: 'generated',
        seed: 1,
        cells: [
            { block: false, given: '1', label: null },
            { block: false, given: null, label: null },
            { block: false, given: null, label: null },
            { block: false, given: null, label: null },
        ],
        meta: { regionRows: 1, regionCols: 2, alphabet: '1234' },
    };
}

/** A room mid-puzzle, with whatever the test wants already on the board. */
function playingRoom(cells = {}, streak = 0) {
    const room = createRoom();
    room.state = ROOM_STATE.PLAYING;
    room.doc = fixtureDoc();
    room.solution = SOLUTION;
    room.board = { seq: 1, cells };
    room.startedAt = Date.now() - 5000;
    room.streak = streak;
    room.assists = 0;
    return room;
}

describe('checkPuzzle', () => {
    let room;

    beforeEach(() => {
        room = playingRoom({
            1: { value: '2', marks: [], by: 'p1', seq: 1 },
            2: { value: '9', marks: [], by: 'p1', seq: 1 },
        });
    });

    it('grades filled cells and omits the empty ones', () => {
        const result = checkPuzzle(room, sudoku);

        expect(result.cells).toEqual({ 1: 'correct', 2: 'wrong' });
        expect(result.cells[3]).toBeUndefined();
    });

    it('omits givens, which are not something the room got right', () => {
        expect(checkPuzzle(room, sudoku).cells[0]).toBeUndefined();
    });

    it('counts one assist', () => {
        expect(checkPuzzle(room, sudoku).assists).toBe(1);
        expect(checkPuzzle(room, sudoku).assists).toBe(2);
    });

    it('is free: it never touches the streak or ends the puzzle', () => {
        room.streak = 3;
        checkPuzzle(room, sudoku);

        expect(room.streak).toBe(3);
        expect(room.state).toBe(ROOM_STATE.PLAYING);
    });

    it('refuses to run without a puzzle rather than reporting an empty grid as checked', () => {
        const empty = createRoom();
        expect(() => checkPuzzle(empty, sudoku)).toThrow(TypeError);
    });
});

describe('solvePuzzle', () => {
    it('increments the streak and ends the puzzle', () => {
        const room = playingRoom({}, 2);
        const result = solvePuzzle(room);

        expect(room.streak).toBe(3);
        expect(room.state).toBe(ROOM_STATE.SOLVED);
        expect(result.revealed).toBe(false);
        expect(result.streak).toBe(3);
    });

    it('reports the elapsed time from the server clock, not a client claim', () => {
        const room = playingRoom();
        expect(solvePuzzle(room).elapsedMs).toBeGreaterThanOrEqual(5000);
    });
});

describe('revealPuzzle', () => {
    it('fills every editable cell from the solution', () => {
        const room = playingRoom();
        revealPuzzle(room);

        expect(room.board.cells[1].value).toBe('2');
        expect(room.board.cells[2].value).toBe('3');
        expect(room.board.cells[3].value).toBe('4');
    });

    it('leaves the given alone, since nobody wrote it', () => {
        const room = playingRoom();
        revealPuzzle(room);

        expect(room.board.cells[0]).toBeUndefined();
    });

    it('attributes revealed cells to nobody', () => {
        const room = playingRoom();
        revealPuzzle(room);

        expect(room.board.cells[1].by).toBeNull();
    });

    it('resets the streak and counts an assist', () => {
        const room = playingRoom({}, 4);
        const result = revealPuzzle(room);

        expect(room.streak).toBe(0);
        expect(result.streak).toBe(0);
        expect(result.assists).toBe(1);
        expect(result.revealed).toBe(true);
        expect(room.state).toBe(ROOM_STATE.SOLVED);
    });

    it('advances the board seq so clients treat it as newer than anything they hold', () => {
        const room = playingRoom();
        const before = room.board.seq;
        revealPuzzle(room);

        expect(room.board.seq).toBe(before + 1);
    });
});

describe('abandonPuzzle', () => {
    it('resets the streak when the room walks away from an unfinished puzzle', () => {
        const room = playingRoom({}, 3);

        expect(abandonPuzzle(room)).toBe(true);
        expect(room.streak).toBe(0);
        expect(room.state).toBe(ROOM_STATE.SELECT);
        expect(room.doc).toBeNull();
    });

    it('keeps the streak when the puzzle it leaves was already solved', () => {
        const room = playingRoom({}, 3);
        solvePuzzle(room);

        expect(abandonPuzzle(room)).toBe(false);
        expect(room.streak).toBe(4);
        expect(room.state).toBe(ROOM_STATE.SELECT);
    });

    it('clears the solution along with the puzzle', () => {
        const room = playingRoom();
        abandonPuzzle(room);

        expect(room.solution).toBeNull();
    });
});
