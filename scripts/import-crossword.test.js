/**
 * The importer, and above all the things it refuses (design-spec.md §8). A crossword that imports
 * slightly wrong is worse than one that does not, so every refusal gets a test, built on a crafted
 * .puz assembled byte by byte here rather than a real file (the four real ones are gitignored).
 */

import { describe, expect, it } from 'vitest';

import { ImportError, readIpuz, readPuz, toBankFile } from './import-crossword.js';

/**
 * Builds a .puz file from a solution picture, so a test can state a grid and get bytes.
 *
 * @param {object} options - What the file should contain.
 * @returns {Buffer} A complete .puz.
 */
function buildPuz({ rows, clues, scrambled = 0, extensions = {}, notes = '' }) {
    const cols = rows[0].length;
    // The pictures here use # for a black square because that is what .ipuz and the human eye
    // use; .puz spells the same thing ., so the fixture translates rather than the reader.
    const solution = rows.join('').replaceAll('#', '.');
    const player = solution.replace(/[^.]/g, '-');

    const header = Buffer.alloc(0x34);
    header.write('ACROSS&DOWN\0', 0x02, 'latin1');
    header.write('1.3\0', 0x18, 'latin1');
    header.writeUInt16LE(scrambled, 0x32);
    header.writeUInt8(cols, 0x2c);
    header.writeUInt8(rows.length, 0x2d);
    header.writeUInt16LE(clues.length, 0x2e);

    const strings = ['Test Puzzle', 'A Person', '© Nobody', ...clues, notes]
        .map((text) => `${text}\0`)
        .join('');

    const sections = Object.entries(extensions).map(([title, data]) => {
        const head = Buffer.alloc(8);
        head.write(title, 0, 'latin1');
        head.writeUInt16LE(data.length, 4);
        return Buffer.concat([head, Buffer.from(data), Buffer.from([0])]);
    });

    return Buffer.concat([
        header,
        Buffer.from(solution, 'latin1'),
        Buffer.from(player, 'latin1'),
        Buffer.from(strings, 'latin1'),
        ...sections,
    ]);
}

/** Clues for the corner-blocked 5×5, in the order numbering produces them. */
const MINI_CLUES = ['1A', '1D', '2D', '3D', '4A', '4D', '5D', '6A', '7A', '8A'];
const MINI_ROWS = ['#CAT#', 'ELBOW', 'YOUTH', 'ESSAY', '#EEL#'];

describe('readPuz', () => {
    it('reads the grid, the clues, and the source metadata', () => {
        const parsed = readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES }));

        expect(parsed.size).toEqual({ rows: 5, cols: 5 });
        expect(parsed.blocks.filter(Boolean)).toHaveLength(4);
        expect(parsed.answers[1]).toBe('C');
        expect(parsed.answers[0]).toBeNull();
        expect(parsed.clues).toEqual(MINI_CLUES);
        expect(parsed.title).toBe('Test Puzzle');
        expect(parsed.copyright).toBe('© Nobody');
    });

    /**
     * The notes string sits after the clues and before the extension sections. Stopping the string
     * scan one short leaves the section scan starting inside prose, reporting a puzzle with no rebus or
     * circles rather than failing, which is the bug this file was written after.
     */
    it('finds the extensions even when the puzzle carries notes', () => {
        const gext = new Uint8Array(25);
        gext[7] = 0x80;
        const parsed = readPuz(
            buildPuz({
                rows: MINI_ROWS,
                clues: MINI_CLUES,
                notes: 'Theme: the circled squares spell something.',
                extensions: { GEXT: gext },
            }),
        );

        expect(parsed.circled).toEqual([7]);
    });

    it('carries a rebus square as the whole word it holds', () => {
        const grbs = new Uint8Array(25);
        grbs[1] = 1;
        const parsed = readPuz(
            buildPuz({
                rows: MINI_ROWS,
                clues: MINI_CLUES,
                extensions: { GRBS: grbs, RTBL: ' 0:CAT;' },
            }),
        );

        expect(parsed.answers[1]).toBe('CAT');
        expect(parsed.answers[2]).toBe('A');
    });

    it('refuses a file that is not a .puz at all', () => {
        expect(() => readPuz(Buffer.alloc(200))).toThrow(/ACROSS&DOWN/);
    });

    /** The solution is locked, so the puzzle could be displayed and never checked or completed. */
    it('refuses a scrambled solution', () => {
        expect(() =>
            readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES, scrambled: 1 })),
        ).toThrow(/scrambled/);
    });

    it('refuses a grid larger than the client renders', () => {
        const rows = new Array(26).fill('.'.repeat(26));
        expect(() => readPuz(buildPuz({ rows, clues: [] }))).toThrow(/larger than/);
    });

    it('refuses a rebus square whose table entry is missing', () => {
        const grbs = new Uint8Array(25);
        grbs[1] = 4;
        expect(() =>
            readPuz(
                buildPuz({
                    rows: MINI_ROWS,
                    clues: MINI_CLUES,
                    extensions: { GRBS: grbs, RTBL: '' },
                }),
            ),
        ).toThrow(/table lacks/);
    });
});

describe('readIpuz', () => {
    const mini = {
        kind: ['http://ipuz.org/crossword#1'],
        dimensions: { width: 5, height: 5 },
        title: 'Mini',
        puzzle: [
            ['#', 1, 2, 3, '#'],
            [4, 0, 0, 0, 5],
            [6, 0, 0, 0, 0],
            [7, 0, 0, 0, 0],
            ['#', 8, 0, 0, '#'],
        ],
        solution: MINI_ROWS.map((row) => [...row]),
        clues: {
            Across: [
                [1, '1A'],
                [4, '4A'],
                [6, '6A'],
                [7, '7A'],
                [8, '8A'],
            ],
            Down: [
                [1, '1D'],
                [2, '2D'],
                [3, '3D'],
                [4, '4D'],
                [5, '5D'],
            ],
        },
    };

    /**
     * 0 means an open square with no number, not a block. Reading it as a block turns most of the
     * grid black and leaves a puzzle of disconnected single letters.
     */
    it('treats a zero as an open square rather than a black one', () => {
        const parsed = readIpuz(JSON.stringify(mini));
        expect(parsed.blocks.filter(Boolean)).toHaveLength(4);
        expect(parsed.answers[6]).toBe('L');
    });

    it('interleaves the two clue lists into numbering order', () => {
        const parsed = readIpuz(JSON.stringify(mini));
        expect(parsed.clues).toEqual(MINI_CLUES);
    });

    it('refuses a kind of puzzle it cannot convert', () => {
        const sudoku = { ...mini, kind: ['http://ipuz.org/sudoku#1'] };
        expect(() => readIpuz(JSON.stringify(sudoku))).toThrow(/not a crossword/);
    });

    it('refuses a file with no solution, which could never be checked', () => {
        const { solution, ...noSolution } = mini;
        expect(() => readIpuz(JSON.stringify(noSolution))).toThrow(/no solution/);
    });
});

describe('toBankFile', () => {
    const options = { id: 'test-1', difficulty: 'easy', license: 'CC0-1.0' };

    it('produces a document whose numbering, labels, and clues agree', () => {
        const parsed = readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES }));
        const { doc, solution, manifest } = toBankFile(parsed, options);

        expect(doc.meta.entries).toHaveLength(10);
        expect(doc.meta.entries[0]).toMatchObject({ num: 1, dir: 'A', clue: '1A' });
        expect(doc.cells[1].label).toBe('1');
        expect(doc.cells[0]).toEqual({ block: true, given: null, label: null });
        // A crossword has no givens: every open square is the player's to fill.
        expect(doc.cells.every((cell) => cell.given === null)).toBe(true);
        expect(solution[0]).toBeNull();
        expect(manifest.license).toBe('CC0-1.0');
        // The source's own copyright line is carried as evidence, not as permission.
        expect(manifest.source).toBe('© Nobody');
    });

    /**
     * The check that caught a real off-by-one during this phase's own development: the reader was
     * counting the notes string as a clue, and the grid disagreed with the list by exactly one.
     */
    it('refuses a file whose grid and clue list disagree', () => {
        const parsed = readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES.slice(0, 9) }));
        expect(() => toBankFile(parsed, options)).toThrow(/implies 10 entries.*carries 9/);
    });

    it('refuses an answer that is not plain letters', () => {
        const parsed = readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES }));
        parsed.answers[1] = 'C4T';
        expect(() => toBankFile(parsed, options)).toThrow(/not plain letters/);
    });

    it('refuses a rebus longer than a cell can hold', () => {
        const parsed = readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES }));
        parsed.answers[1] = 'ABCDEFGHI';
        expect(() => toBankFile(parsed, options)).toThrow(/longer than/);
    });

    it('reports refusals as ImportError, which the CLI turns into a message rather than a crash', () => {
        const parsed = readPuz(buildPuz({ rows: MINI_ROWS, clues: MINI_CLUES.slice(0, 9) }));
        expect(() => toBankFile(parsed, options)).toThrow(ImportError);
    });
});
