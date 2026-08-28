/**
 * The live solve timer, counting up in mm:ss.
 *
 * Ticks are local. The server sends startedAt and its own clock once, the client computes an
 * offset, and no timer traffic ever crosses the wire (design-spec.md §6). The number in the
 * completion modal is the server's, not this one.
 */

import { LitElement, css, html } from 'lit';

export class PtTimer extends LitElement {
    static properties = {
        startedAt: { type: Number },
        clockOffsetMs: { type: Number },
        frozenMs: { type: Number },
    };

    static styles = css`
        :host {
            display: block;
            font-family: var(--font-ui);
            font-size: var(--text-lg);
            font-variant-numeric: tabular-nums;
            color: var(--graphite);
            text-align: center;
        }
    `;

    #interval = null;

    constructor() {
        super();
        this.startedAt = null;
        this.clockOffsetMs = 0;
        this.frozenMs = null;
    }

    /** Starts ticking once a second while the element is on screen. */
    connectedCallback() {
        super.connectedCallback();
        this.#interval = setInterval(() => this.requestUpdate(), 1000);
    }

    /** Stops the tick so a removed timer cannot keep re-rendering. */
    disconnectedCallback() {
        clearInterval(this.#interval);
        this.#interval = null;
        super.disconnectedCallback();
    }

    /** Elapsed milliseconds, measured against the server's clock rather than the browser's. */
    get #elapsedMs() {
        if (this.frozenMs != null) return this.frozenMs;
        if (!this.startedAt) return 0;
        return Math.max(0, Date.now() + this.clockOffsetMs - this.startedAt);
    }

    render() {
        const totalSeconds = Math.floor(this.#elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const label = `${minutes}:${String(seconds).padStart(2, '0')}`;
        return html`<span role="timer" aria-label="elapsed time ${label}">${label}</span>`;
    }
}

customElements.define('pt-timer', PtTimer);
