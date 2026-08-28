/**
 * The bank loader, against the real tracked bank and against deliberately broken fixtures.
 *
 * Two jobs, and the second is the interesting one. Loading data/crosswords/ proves the seed minis
 * are sound: the tracked content is checked by the same suite as the code, which is the point of
 * having the loader re-derive numbering at boot. Everything after that feeds it files that are
 * wrong in a specific way and asks it to notice.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bankCatalog, loadBank, resetBank, takeFromBank } from './bank.js';

/** The tracked bank the app actually ships with. */
const TRACKED = fileURLToPath(new URL('../../data/crosswords', import.meta.url));

const scratch = [];

/** Writes a throwaway bank directory and returns its path. */
function bankDir(puzzles) {
    const dir = mkdtempSync(join(tmpdir(), 'pt-bank-'));
    scratch.push(dir);
    mkdirSync(dir, { recursive: true });

    const manifest = puzzles.map((entry, i) => ({
        id: entry.id ?? `p${i}`,
        file: `${entry.id ?? `p${i}`}.json`,
        license: 'CC0-1.0',
    }));
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ puzzles: manifest }));
    for (const [i, entry] of puzzles.entries()) {
        writeFileSync(join(dir, manifest[i].file), JSON.stringify(entry.file ?? entry));
    }
    return dir;
}

/** A sound 3×3 bank file, which each test then breaks in exactly one way. */
function soundPuzzle(id = 'ok') {
    const cells = [...'CATAREEAR'].map(() => ({ block: false, given: null, label: null }));
    for (const idx of [0, 1, 2]) cells[idx].label = String(idx + 1);
    cells[3].label = '4';
    cells[6].label = '5';

    return {
        id,
        file: {
            doc: {
                id,
                type: 'crossword',
                version: 1,
                size: { rows: 3, cols: 3 },
                difficulty: 'easy',
                title: 'Tiny',
                author: null,
                source: 'bank',
                seed: null,
                cells,
                meta: {
                    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                    circled: [],
                    entries: [
                        { num: 1, dir: 'A', cells: [0, 1, 2], len: 3, clue: 'a' },
                        { num: 1, dir: 'D', cells: [0, 3, 6], len: 3, clue: 'b' },
                        { num: 2, dir: 'D', cells: [1, 4, 7], len: 3, clue: 'c' },
                        { num: 3, dir: 'D', cells: [2, 5, 8], len: 3, clue: 'd' },
                        { num: 4, dir: 'A', cells: [3, 4, 5], len: 3, clue: 'e' },
                        { num: 5, dir: 'A', cells: [6, 7, 8], len: 3, clue: 'f' },
                    ],
                },
            },
            solution: [...'CATAREEAR'],
        },
    };
}

afterEach(() => {
    resetBank();
    vi.restoreAllMocks();
    while (scratch.length > 0) rmSync(scratch.pop(), { recursive: true, force: true });
});

describe('the tracked bank', () => {
    /**
     * The seed minis are content, and content can be wrong in ways review does not catch. Loading
     * them here means a hand-edit that breaks a grid's numbering fails the unit suite rather than a
     * room mid-solve.
     */
    it('loads, and every seed mini validates against its own grid', () => {
        expect(loadBank([TRACKED])).toBeGreaterThanOrEqual(4);

        const offered = bankCatalog();
        expect(offered.sizes).toContainEqual({ rows: 5, cols: 5 });
        expect(offered.difficulties.length).toBeGreaterThan(0);
    });

    it('hands back a deep copy, so one room cannot edit the puzzle the next one gets', () => {
        loadBank([TRACKED]);
        const first = takeFromBank({ difficulty: 'easy', size: { rows: 5, cols: 5 } });
        first.doc.cells[0].label = 'tampered';

        const second = takeFromBank({ difficulty: 'easy', size: { rows: 5, cols: 5 } });
        expect(second.doc.cells[0].label).not.toBe('tampered');
    });
});

describe('refusing broken files', () => {
    /** One bad file is refused and said out loud; the rest of the bank still loads. */
    it('skips a puzzle whose entries disagree with its grid, keeping the others', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const broken = soundPuzzle('broken');
        broken.file.doc.meta.entries[0].cells = [0, 1];

        expect(loadBank([bankDir([soundPuzzle('good'), broken])])).toBe(1);
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/broken: refused/));
    });

    it('refuses a black square that carries an answer', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const bad = soundPuzzle('bad');
        bad.file.doc.cells[0].block = true;

        expect(loadBank([bankDir([bad])])).toBe(0);
    });

    it('refuses an open square with no answer, which could never be completed', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const bad = soundPuzzle('bad');
        bad.file.solution[4] = null;

        expect(loadBank([bankDir([bad])])).toBe(0);
    });

    it('refuses an answer outside the alphabet', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const bad = soundPuzzle('bad');
        bad.file.solution[4] = '7';

        expect(loadBank([bankDir([bad])])).toBe(0);
    });

    it('survives a missing directory, which is the normal state of the local overlay', () => {
        expect(loadBank([join(tmpdir(), 'pt-bank-does-not-exist')])).toBe(0);
        expect(bankCatalog()).toBeNull();
    });
});

describe('choosing a puzzle', () => {
    it('does not hand back a puzzle the room has already been served', () => {
        loadBank([bankDir([soundPuzzle('a'), soundPuzzle('b')])]);

        const first = takeFromBank({ difficulty: 'easy', size: { rows: 3, cols: 3 } });
        const second = takeFromBank({
            difficulty: 'easy',
            size: { rows: 3, cols: 3 },
            exclude: [first.doc.id],
        });
        expect(second.doc.id).not.toBe(first.doc.id);
    });

    /** Repeating beats refusing to start once a room has played everything the bank holds. */
    it('starts over rather than failing when the room has seen them all', () => {
        loadBank([bankDir([soundPuzzle('a')])]);
        const again = takeFromBank({
            difficulty: 'easy',
            size: { rows: 3, cols: 3 },
            exclude: ['a'],
        });
        expect(again.doc.id).toBe('a');
    });

    /**
     * Size is honoured exactly and difficulty is a preference: a host who asked for a 15×15 and got
     * a mini has been given the wrong puzzle, but a bank of a dozen files cannot promise every
     * combination, and the document's own label is what the game screen displays either way.
     */
    it('honours size exactly and treats difficulty as a preference', () => {
        loadBank([bankDir([soundPuzzle('a')])]);

        expect(
            takeFromBank({ difficulty: 'hard', size: { rows: 3, cols: 3 } }).doc.difficulty,
        ).toBe('easy');
        expect(() => takeFromBank({ difficulty: 'easy', size: { rows: 15, cols: 15 } })).toThrow(
            /no 15x15/,
        );
    });
});
