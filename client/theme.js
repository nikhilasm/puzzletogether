/**
 * Light and dark, chosen once and remembered.
 *
 * The whole theme is a token swap: data-theme on <html> selects a block in tokens.css and
 * nothing else in the app knows a theme exists (code-style.md §9). This module owns the attribute,
 * the stored preference, and nothing more.
 */

/** Where the chosen theme lives between visits. */
const STORAGE_KEY = 'pt:theme';

/** The two themes, named as they appear in data-theme. */
export const THEME = {
    LIGHT: 'light',
    DARK: 'dark',
};

/**
 * Decides which theme to show.
 *
 * An explicit choice always wins; without one the OS preference decides, so a first visit at night
 * is dark without anybody having asked for it.
 *
 * @param {string|null} stored - A previously stored choice, or null.
 * @param {boolean} prefersDark - Whether the OS asks for dark.
 * @returns {string} One of THEME.
 */
export function resolveTheme(stored, prefersDark) {
    if (stored === THEME.LIGHT || stored === THEME.DARK) return stored;
    return prefersDark ? THEME.DARK : THEME.LIGHT;
}

/** Reads the stored preference, tolerating a localStorage that refuses to answer. */
function readStored() {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // Private-browsing modes throw here; falling back to the OS preference is fine.
        return null;
    }
}

/** Stores the preference, accepting that it may not survive if storage is unavailable. */
function writeStored(theme) {
    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // Losing the preference costs one re-toggle, which is not worth failing the click over.
    }
}

/** Whether the OS is currently asking for a dark interface. */
function prefersDark() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * The theme currently applied to the document.
 *
 * @returns {string} One of THEME.
 */
export function currentTheme() {
    return document.documentElement.dataset.theme === THEME.DARK ? THEME.DARK : THEME.LIGHT;
}

/**
 * Applies a theme to the document without storing it.
 *
 * @param {string} theme - One of THEME.
 * @returns {void}
 */
export function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

/**
 * Applies the theme this visitor should see. Called before first paint.
 *
 * @returns {string} The theme that was applied.
 */
export function initTheme() {
    const theme = resolveTheme(readStored(), prefersDark());
    applyTheme(theme);
    return theme;
}

/**
 * Switches to the other theme and remembers the choice.
 *
 * @returns {string} The theme now in force.
 */
export function toggleTheme() {
    const next = currentTheme() === THEME.DARK ? THEME.LIGHT : THEME.DARK;
    applyTheme(next);
    writeStored(next);
    return next;
}
