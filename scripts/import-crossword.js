/**
 * Converts a .puz or .ipuz crossword into a bank file (design-spec.md §8). Run by hand, never at boot,
 * and it refuses more than it converts: a crossword that imports slightly wrong is worse than one that
 * does not, so every doubt is an error with a reason attached.
 *
 * Usage:
 *   node scripts/import-crossword.js <file...> --out <dir> --license <text> [--difficulty <level>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import { DIFFICULTIES, MAX_CELL_VALUE_LENGTH } from '../shared/constants.js';
import { ALPHABET, DOC_VERSION } from '../server/puzzles/crossword/index.js';
import { numberGrid } from '../server/puzzles/crossword/numbering.js';

/** Largest grid the client renders, mirroring schema.js. */
const MAX_SIDE = 25;

/** A refusal with a reason a person can act on, as distinct from a crash. */
class ImportError extends Error {}

// ---------------------------------------------------------------------------------------------
// .puz
// ---------------------------------------------------------------------------------------------

/** Byte offsets into a .puz header, which is fixed-layout and little-endian. */
const PUZ = {
    MAGIC: 0x02,
    SCRAMBLED: 0x32,
    WIDTH: 0x2c,
    HEIGHT: 0x2d,
    CLUE_COUNT: 0x2e,
    SOLUTION: 0x34,
};

/**
 * Reads the NUL-terminated strings that follow the two grids.
 *
 * .puz stores its text as Latin-1, not UTF-8: a détente or a naïve in a clue arrives as a single
 * high byte, and decoding it as UTF-8 produces a replacement character in the middle of somebody's
 * wordplay.
 *
 * @param {Buffer} buffer - The whole file.
 * @param {number} start - Offset of the first string.
 * @param {number} count - How many strings to read.
 * @returns {{ strings: string[], end: number }} The strings and where they stopped.
 */
function readStrings(buffer, start, count) {
    const strings = [];
    let at = start;

    for (let i = 0; i < count; i += 1) {
        const nul = buffer.indexOf(0, at);
        if (nul === -1) throw new ImportError(`file ends mid-string (wanted ${count}, got ${i})`);
        strings.push(buffer.toString('latin1', at, nul));
        at = nul + 1;
    }

    return { strings, end: at };
}

/**
 * Reads the optional extension sections that follow the strings. Each is a 4-character title, a
 * little-endian length, a checksum this does not verify, then the data and a NUL; unknown sections are
 * skipped by length rather than guessed at, so an unfamiliar one does not make the file unreadable.
 *
 * @param {Buffer} buffer - The whole file.
 * @param {number} start - Offset just past the last string.
 * @returns {Object<string, Buffer>} Section data by title.
 */
function readExtensions(buffer, start) {
    const sections = {};
    let at = start;

    while (at + 8 <= buffer.length) {
        const title = buffer.toString('latin1', at, at + 4);
        if (!/^[A-Z]{4}$/.test(title)) break;
        const length = buffer.readUInt16LE(at + 4);
        const from = at + 8;
        if (from + length > buffer.length) break;
        sections[title] = buffer.subarray(from, from + length);
        at = from + length + 1;
    }

    return sections;
}

/**
 * Parses the rebus table: " 1:HAND; 3:ONE;", keyed by the number GRBS refers to minus one.
 *
 * @param {Buffer} table - The RTBL section.
 * @returns {Map<number, string>} Rebus answers by GRBS value.
 */
function readRebusTable(table) {
    const answers = new Map();

    for (const part of table.toString('latin1').split(';')) {
        if (part.trim() === '') continue;
        const [key, value] = part.split(':');
        const index = Number.parseInt(key.trim(), 10);
        if (!Number.isInteger(index) || value == null) {
            throw new ImportError(`rebus table entry is unreadable: "${part}"`);
        }
        // GRBS stores the table key plus one, so that zero can mean "no rebus here".
        answers.set(index + 1, value.trim().toUpperCase());
    }

    return answers;
}

/**
 * Parses a .puz file into the neutral shape the writer below consumes.
 *
 * @param {Buffer} buffer - The whole file.
 * @returns {object} Grid, answers, clues, and the source's own metadata.
 * @throws {ImportError} If the file is not a .puz, is scrambled, or is bigger than we render.
 */
function readPuz(buffer) {
    if (buffer.length < PUZ.SOLUTION) throw new ImportError('too short to be a .puz file');
    if (buffer.toString('latin1', PUZ.MAGIC, PUZ.MAGIC + 11) !== 'ACROSS&DOWN') {
        throw new ImportError('not a .puz file (missing the ACROSS&DOWN marker)');
    }

    // A scrambled puzzle's solution is deliberately unreadable. We could store the grid and the
    // clues, but not the answers, so the puzzle could be displayed and never checked or completed.
    if (buffer.readUInt16LE(PUZ.SCRAMBLED) !== 0) {
        throw new ImportError('the solution is scrambled, so it cannot be read honestly');
    }

    const cols = buffer.readUInt8(PUZ.WIDTH);
    const rows = buffer.readUInt8(PUZ.HEIGHT);
    if (rows < 1 || cols < 1) throw new ImportError(`nonsensical grid: ${rows}x${cols}`);
    if (rows > MAX_SIDE || cols > MAX_SIDE) {
        throw new ImportError(
            `${rows}x${cols} is larger than the ${MAX_SIDE}x${MAX_SIDE} we render`,
        );
    }

    const total = rows * cols;
    const clueCount = buffer.readUInt16LE(PUZ.CLUE_COUNT);
    const solutionBytes = buffer.subarray(PUZ.SOLUTION, PUZ.SOLUTION + total);
    if (solutionBytes.length !== total) throw new ImportError('file ends inside the solution grid');

    // Title, author, copyright, then one string per clue, then the notes, so three before and one
    // after. The notes have to be *consumed* even though nothing here wants them: the extension
    // sections begin where the strings end, and stopping a string early leaves that scan starting
    // inside somebody's prose, where it finds no sections and silently reports a puzzle with no
    // rebus and no circles.
    const stringsAt = PUZ.SOLUTION + total * 2;
    const { strings, end } = readStrings(buffer, stringsAt, clueCount + 4);
    const [title, author, copyright] = strings;
    const clues = strings.slice(3, 3 + clueCount);

    const sections = readExtensions(buffer, end);
    const rebusTable = sections.RTBL ? readRebusTable(sections.RTBL) : new Map();
    const rebusGrid = sections.GRBS ?? null;
    // GEXT bit 0x80 is a circled square, which is usually where a themed puzzle keeps its bonus.
    const circled = sections.GEXT
        ? [...sections.GEXT.keys()].filter((idx) => (sections.GEXT[idx] & 0x80) !== 0)
        : [];

    const blocks = [];
    const answers = [];
    for (let idx = 0; idx < total; idx += 1) {
        const char = String.fromCharCode(solutionBytes[idx]);
        if (char === '.') {
            blocks.push(true);
            answers.push(null);
            continue;
        }
        blocks.push(false);

        const rebusKey = rebusGrid?.[idx] ?? 0;
        const answer = rebusKey !== 0 ? rebusTable.get(rebusKey) : char.toUpperCase();
        if (answer == null) {
            throw new ImportError(`cell ${idx} claims rebus ${rebusKey}, which the table lacks`);
        }
        answers.push(answer);
    }

    return {
        size: { rows, cols },
        blocks,
        answers,
        clues,
        circled,
        title: title || null,
        author: author || null,
        copyright: copyright || null,
    };
}

// ---------------------------------------------------------------------------------------------
// .ipuz
// ---------------------------------------------------------------------------------------------

/**
 * Whether an .ipuz grid cell is a black square. 0 is deliberately not one: in .ipuz a zero means an
 * open square that carries no number, and reading it as a block would turn every unnumbered square
 * black.
 */
function isIpuzBlock(cell) {
    return cell === '#' || cell === null || cell?.cell === '#';
}

/**
 * Parses the crossword subset of .ipuz. A deliberate subset, since .ipuz can describe acrostics,
 * sudoku, and much else, so anything outside a plain crossword is refused by name.
 *
 * @param {string} text - The file's contents.
 * @returns {object} The same neutral shape readPuz returns.
 * @throws {ImportError} If it is not a crossword, or is missing its solution.
 */
function readIpuz(text) {
    let file;
    try {
        file = JSON.parse(text);
    } catch (error) {
        throw new ImportError(`not valid JSON: ${error.message}`);
    }

    const kind = (file.kind ?? []).join(' ');
    if (!kind.includes('crossword')) {
        throw new ImportError(`kind is "${kind || 'unstated'}", which is not a crossword`);
    }
    if (!Array.isArray(file.solution)) {
        throw new ImportError('no solution grid, so the puzzle could never be checked');
    }

    const rows = file.dimensions?.height;
    const cols = file.dimensions?.width;
    if (!Number.isInteger(rows) || !Number.isInteger(cols)) throw new ImportError('bad dimensions');
    if (rows > MAX_SIDE || cols > MAX_SIDE) {
        throw new ImportError(
            `${rows}x${cols} is larger than the ${MAX_SIDE}x${MAX_SIDE} we render`,
        );
    }

    const blocks = [];
    const answers = [];
    const circled = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const idx = row * cols + col;
            const gridCell = file.puzzle?.[row]?.[col];
            const answer = file.solution[row]?.[col];

            if (isIpuzBlock(gridCell) || isIpuzBlock(answer)) {
                blocks.push(true);
                answers.push(null);
                continue;
            }
            blocks.push(false);
            const text = typeof answer === 'object' ? answer.value : answer;
            answers.push(String(text ?? '').toUpperCase());
            if (gridCell?.style?.shapebg === 'circle') circled.push(idx);
        }
    }

    // .ipuz splits its clues by direction; the bank stores them in numbering order, Across before
    // Down at the same number, which is what numberGrid produces and what .puz already uses.
    const across = (file.clues?.Across ?? []).map((clue) => ({ dir: 'A', clue }));
    const down = (file.clues?.Down ?? []).map((clue) => ({ dir: 'D', clue }));
    const byNumber = [...across, ...down]
        .map(({ dir, clue }) => ({
            dir,
            num: Array.isArray(clue) ? clue[0] : clue.number,
            text: Array.isArray(clue) ? clue[1] : clue.clue,
        }))
        .sort((a, b) => a.num - b.num || (a.dir === 'A' ? -1 : 1));

    return {
        size: { rows, cols },
        blocks,
        answers,
        clues: byNumber.map((entry) => String(entry.text)),
        circled,
        title: file.title ?? null,
        author: file.author ?? null,
        copyright: file.copyright ?? null,
    };
}

// ---------------------------------------------------------------------------------------------
// Bank file
// ---------------------------------------------------------------------------------------------

/**
 * Turns a parsed puzzle into the document and solution a bank file holds. The numbering is derived
 * here and the clue count checked against it, since a grid and clue list that disagree about the black
 * squares would silently shift every clue after the disagreement onto the wrong entry.
 *
 * @param {object} parsed - Output of readPuz or readIpuz.
 * @param {object} options - Identity and provenance for the bank.
 * @returns {{ doc: object, solution: (string|null)[], manifest: object }} The file and its entry.
 * @throws {ImportError} If the grid and the clue list disagree, or a rebus is too long.
 */
function toBankFile(parsed, { id, difficulty, license, source }) {
    const { size, blocks, answers, clues, circled } = parsed;
    const { labels, entries } = numberGrid(blocks, size);

    if (entries.length !== clues.length) {
        throw new ImportError(
            `the grid implies ${entries.length} entries but the file carries ${clues.length} clues`,
        );
    }

    for (let idx = 0; idx < answers.length; idx += 1) {
        const answer = answers[idx];
        if (answer == null) continue;
        if (answer.length === 0) throw new ImportError(`cell ${idx} has an empty answer`);
        if (answer.length > MAX_CELL_VALUE_LENGTH) {
            throw new ImportError(
                `cell ${idx} answers "${answer}", longer than the ${MAX_CELL_VALUE_LENGTH} characters a cell holds`,
            );
        }
        if (![...answer].every((letter) => ALPHABET.includes(letter))) {
            throw new ImportError(`cell ${idx} answers "${answer}", which is not plain letters`);
        }
    }

    const doc = {
        id,
        type: 'crossword',
        version: DOC_VERSION,
        size,
        difficulty,
        title: parsed.title,
        author: parsed.author,
        source: 'bank',
        seed: null,
        cells: blocks.map((block, idx) => ({
            block,
            // A crossword has no givens: every open square is the player's to fill.
            given: null,
            label: labels[idx],
        })),
        meta: {
            entries: entries.map((entry, i) => ({ ...entry, clue: clues[i] })),
            alphabet: ALPHABET,
            circled,
        },
    };

    return {
        doc,
        solution: answers,
        manifest: {
            id,
            file: `${id}.json`,
            size,
            difficulty,
            title: parsed.title,
            author: parsed.author,
            // The source's own copyright line, carried verbatim. It is evidence, not permission.
            source: source ?? parsed.copyright ?? null,
            license,
        },
    };
}

/** Reads a bank directory's manifest, or an empty one when it does not exist yet. */
function readManifest(dir) {
    const path = join(dir, 'index.json');
    if (!existsSync(path)) return { puzzles: [] };
    return JSON.parse(readFileSync(path, 'utf8'));
}

/** Writes the puzzle and adds or replaces its manifest entry, keeping the list sorted by id. */
function writeToBank(dir, built) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, built.manifest.file),
        `${JSON.stringify({ doc: built.doc, solution: built.solution }, null, 2)}\n`,
    );

    const manifest = readManifest(dir);
    const puzzles = manifest.puzzles.filter((entry) => entry.id !== built.manifest.id);
    puzzles.push(built.manifest);
    puzzles.sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(join(dir, 'index.json'), `${JSON.stringify({ puzzles }, null, 2)}\n`);
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

/** Parses --flag value arguments, leaving everything else as an input path. */
function parseArgs(argv) {
    const options = {};
    const files = [];

    for (let i = 0; i < argv.length; i += 1) {
        if (!argv[i].startsWith('--')) {
            files.push(argv[i]);
            continue;
        }
        options[argv[i].slice(2)] = argv[i + 1];
        i += 1;
    }

    return { options, files };
}

/**
 * Converts one file into a parsed puzzle, branching on its extension.
 *
 * @param {string} path - Path to a .puz or .ipuz file.
 * @returns {object} The neutral parsed shape.
 * @throws {ImportError} If the extension is not one we read.
 */
export function readPuzzleFile(path) {
    const ext = extname(path).toLowerCase();
    if (ext === '.puz') return readPuz(readFileSync(path));
    if (ext === '.ipuz') return readIpuz(readFileSync(path, 'utf8'));
    throw new ImportError(`${ext || 'no extension'} is not a format this reads`);
}

/** Exported for the tests, which build files in memory rather than on disk. */
export { readPuz, readIpuz, toBankFile, ImportError };

/**
 * The command line: convert each file, refuse loudly, and report what happened. --license is required
 * and never inferred from the file's own copyright, ADR-0004's build/ship split made mechanical, so
 * nothing reaches a bank directory without a person having answered what may be served from it.
 *
 * @returns {void}
 */
function main() {
    const { options, files } = parseArgs(process.argv.slice(2));

    if (files.length === 0 || !options.out || !options.license) {
        console.error(
            'usage: node scripts/import-crossword.js <file...> --out <dir> --license <text>\n' +
                '                                   [--difficulty easy|medium|hard] [--id <id>]\n\n' +
                '--license is required and is not guessed from the file. Use "unknown" for a\n' +
                'prototype import, which will be recorded as unknown in the manifest.',
        );
        process.exitCode = 1;
        return;
    }

    const difficulty = options.difficulty ?? 'medium';
    if (!DIFFICULTIES.includes(difficulty)) {
        console.error(`--difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
        process.exitCode = 1;
        return;
    }

    let imported = 0;
    for (const file of files) {
        const id = options.id ?? basename(file, extname(file)).toLowerCase().replace(/\W+/g, '-');
        try {
            const parsed = readPuzzleFile(file);
            const built = toBankFile(parsed, {
                id,
                difficulty,
                license: options.license,
                source: options.source,
            });
            writeToBank(options.out, built);
            imported += 1;
            const { rows, cols } = built.doc.size;
            const rebus = built.solution.filter((answer) => (answer?.length ?? 0) > 1).length;
            console.info(
                `imported ${id}: ${rows}x${cols}, ${built.doc.meta.entries.length} entries` +
                    `${rebus > 0 ? `, ${rebus} rebus squares` : ''}` +
                    `${built.doc.meta.circled.length > 0 ? `, ${built.doc.meta.circled.length} circled` : ''}`,
            );
        } catch (error) {
            if (!(error instanceof ImportError)) throw error;
            console.error(`refused ${file}: ${error.message}`);
            process.exitCode = 1;
        }
    }

    if (imported > 0) console.info(`\n${imported} of ${files.length} written to ${options.out}`);
}

// Only when run directly, so the tests can import the readers without the CLI firing.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) main();
