/**
 * Every puzzle type has help, in the shape both places that render it assume.
 *
 * Help is the second per-type entry, alongside the board registry, and it is the one that fails
 * quietly: boardFor throws at a type it does not know, while helpFor returns null and the screens
 * simply leave the way in undrawn. A type shipped without an entry would therefore reach a player as
 * a missing button rather than as an error, which is exactly the kind of gap this suite is for.
 */

import { describe, expect, it } from 'vitest';

import { PUZZLE_TYPES } from '../../shared/constants.js';

import { HELP, helpFor } from './help-text.js';

describe('help text', () => {
    it.each(PUZZLE_TYPES)('%s has an entry', (type) => {
        expect(helpFor(type)).not.toBeNull();
    });

    it.each(PUZZLE_TYPES)('%s states a goal, its rules, and its one setting', (type) => {
        const help = helpFor(type);

        // One sentence, because the picker shows this line alone under the puzzle-type row and a
        // second sentence there would be prose in a place built for a glance.
        expect(help.goal).toMatch(/^[A-Z].*\.$/);
        expect(help.goal.split('. ')).toHaveLength(1);

        // Two to four rules is the fixed shape. Fewer is a type that has not been explained; more
        // is a page rather than a panel.
        expect(help.rules.length).toBeGreaterThanOrEqual(2);
        expect(help.rules.length).toBeLessThanOrEqual(4);
        for (const rule of help.rules) expect(rule).toMatch(/^[A-Z].*\.$/);

        expect(help.input.length).toBeGreaterThan(0);
    });

    it('describes nothing the app cannot render', () => {
        expect(Object.keys(HELP).sort()).toEqual([...PUZZLE_TYPES].sort());
    });

    it('has no help for a type that does not exist', () => {
        expect(helpFor('acrostic')).toBeNull();
    });
});
