import { describe, expect, it } from 'vitest';

import { THEME, resolveTheme } from './theme.js';

describe('resolveTheme', () => {
    it('follows the OS when nothing has been chosen', () => {
        expect(resolveTheme(null, true)).toBe(THEME.DARK);
        expect(resolveTheme(null, false)).toBe(THEME.LIGHT);
    });

    it('lets an explicit choice override the OS in both directions', () => {
        expect(resolveTheme(THEME.LIGHT, true)).toBe(THEME.LIGHT);
        expect(resolveTheme(THEME.DARK, false)).toBe(THEME.DARK);
    });

    it('ignores a stored value it does not recognise rather than passing it through', () => {
        expect(resolveTheme('sepia', false)).toBe(THEME.LIGHT);
        expect(resolveTheme('', true)).toBe(THEME.DARK);
    });
});
