import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PLAYER_COLOR_COUNT } from '../../shared/constants.js';

/**
 * The contrast gate from brand.md §7. It runs in `npm test` specifically so the palette cannot
 * regress quietly — the player colours in the spec were candidate values, and several of them
 * failed this check before they were tuned.
 */

/** WCAG relative luminance for one sRGB channel. */
function channelLuminance(value) {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex) {
    const packed = Number.parseInt(hex.slice(1), 16);
    return (
        0.2126 * channelLuminance((packed >> 16) & 255) +
        0.7152 * channelLuminance((packed >> 8) & 255) +
        0.0722 * channelLuminance(packed & 255)
    );
}

/** Contrast ratio between two colours, per WCAG 2.1. */
function contrast(foreground, background) {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

/** Pulls the custom properties out of one rule block in tokens.css. */
function readTokens(selector) {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    const start = css.indexOf(selector);
    const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));

    const tokens = {};
    for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
        tokens[name] = value;
    }
    return tokens;
}

const THEMES = {
    light: readTokens(':root {'),
    dark: readTokens(":root[data-theme='dark']"),
};

/** Foreground tokens that carry body-size text and so owe the full 4.5:1. */
const BODY_TOKENS = ['ink', 'graphite', 'accent-text', 'pencil', 'correct', 'wrong', 'danger'];

describe.each(Object.entries(THEMES))('%s theme', (_name, tokens) => {
    it('defines every colour token', () => {
        for (const token of [...BODY_TOKENS, 'paper', 'paper-raised', 'accent']) {
            expect(tokens[token], `--${token} is missing`).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
    });

    it.each(BODY_TOKENS)('clears 4.5:1 for --%s on paper', (token) => {
        expect(contrast(tokens[token], tokens.paper)).toBeGreaterThanOrEqual(4.5);
    });

    /**
     * `--accent` is exempt at 3:1 because it is only used for the wordmark, borders, and focus
     * rings — never body-size text, which is what `--accent-text` exists for (brand.md §3).
     */
    it('clears 3:1 for --accent on paper', () => {
        expect(contrast(tokens.accent, tokens.paper)).toBeGreaterThanOrEqual(3);
    });

    it('gives every player colour 4.5:1 on paper', () => {
        for (let index = 0; index < PLAYER_COLOR_COUNT; index += 1) {
            const color = tokens[`player-${index}`];
            expect(color, `--player-${index} is missing`).toBeDefined();
            expect(
                contrast(color, tokens.paper),
                `--player-${index} (${color}) is unreadable on paper`,
            ).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps the player colours distinguishable from each other', () => {
        const colors = Array.from(
            { length: PLAYER_COLOR_COUNT },
            (_unused, index) => tokens[`player-${index}`],
        );
        expect(new Set(colors).size).toBe(PLAYER_COLOR_COUNT);
    });
});
