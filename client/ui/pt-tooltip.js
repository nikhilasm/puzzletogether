/**
 * A one- or two-word name for the control it wraps, shown while a pointer rests on it.
 *
 * It exists for the footer's toolbar, whose controls are icon-only (ADR-0023). It is not the
 * accessible name and never the only place the name lives: the control inside it carries an
 * aria-label, so a screen reader gets the word whether or not anything is drawn, and the bubble is
 * aria-hidden so nobody hears it twice.
 *
 * **Pointer only, by design.** A touch browser emulates hover on whatever was tapped last and holds
 * it (controls.js), so on a phone this would be a label stuck over the last button pressed. The
 * hover query is checked in JavaScript rather than in CSS because what it gates is a state, not a
 * rule. Focus shows it too, which costs nothing and gives a keyboard the same reading a mouse gets.
 *
 * No shadow: there is exactly one in this app and it is under the congrats modal (brand.md §4). A
 * bubble on the page is a surface like any other, so it is an opaque ground inside a 1.5px rule.
 *
 * It is centred on its control and stays centred; the only thing that moves it is a viewport edge
 * it would otherwise hang off, and then by the overhang and nothing more.
 */

import { LitElement, css, html, nothing } from 'lit';

/** How close to the edge of the viewport a bubble may sit before it is nudged back in. */
const EDGE_GAP_PX = 4;

export class PtTooltip extends LitElement {
    static properties = {
        /** The word or two to show. Nothing is drawn when it is empty. */
        text: { type: String },
        showing: { state: true },
    };

    /*
     * No focusRing here, and that is not an oversight: this shadow root holds nothing focusable.
     * The control is slotted, so it stays a child of the root that rendered it and takes that
     * root's ring (controls.js).
     */
    static styles = [
        css`
            /*
             * The wrapper is the flex item its control used to be, so it takes the sizing rules the
             * bar sets and passes the width down. Not display: contents, which is what a wrapper
             * around a single control usually wants: the bubble is positioned against this box, and
             * an element with no box has nothing to position against.
             */
            :host {
                position: relative;
                display: flex;
                box-sizing: border-box;
            }

            ::slotted(*) {
                flex: 1 1 auto;
            }

            /*
             * Centred over the control it names, always. --nudge is 0 except on the one bubble a
             * narrow viewport would otherwise push off the side of the page, which measures itself
             * and shifts by exactly the overhang; see clamp below.
             */
            .bubble {
                position: absolute;
                bottom: calc(100% + var(--space-2));
                left: 50%;
                z-index: 1;
                box-sizing: border-box;
                padding: var(--space-1) var(--space-2);
                border: var(--border);
                border-radius: var(--radius-control);
                background: var(--paper-raised);
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: var(--text-sm);
                line-height: 1.2;
                white-space: nowrap;
                transform: translateX(calc(-50% + var(--nudge, 0px)));
                pointer-events: none;
            }
        `,
    ];

    #onEnter = () => this.#show();
    #onLeave = () => this.#hide();

    constructor() {
        super();
        this.text = '';
        this.showing = false;
    }

    /** Starts listening for a pointer or focus arriving on the control inside. */
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('pointerenter', this.#onEnter);
        this.addEventListener('pointerleave', this.#onLeave);
        this.addEventListener('focusin', this.#onEnter);
        this.addEventListener('focusout', this.#onLeave);
    }

    /** Stops listening, so a detached wrapper cannot leave a bubble behind. */
    disconnectedCallback() {
        this.removeEventListener('pointerenter', this.#onEnter);
        this.removeEventListener('pointerleave', this.#onLeave);
        this.removeEventListener('focusin', this.#onEnter);
        this.removeEventListener('focusout', this.#onLeave);
        super.disconnectedCallback();
    }

    /** Shows the bubble, unless there is nothing to say or nothing that can hover. */
    #show() {
        if (this.text === '') return;
        if (!window.matchMedia('(hover: hover)').matches) return;
        this.showing = true;
    }

    /** Hides the bubble. */
    #hide() {
        this.showing = false;
    }

    /** Keeps a bubble that has just appeared inside the page. */
    updated(changed) {
        if (!changed.has('showing')) return;
        if (this.showing) this.#clamp();
    }

    /**
     * Shifts the bubble back inside the viewport, by the overhang and no more.
     *
     * A bubble is centred on a control that may sit a few pixels from the edge of a phone screen,
     * and "Report issue" is wider than the control it names, so centring alone would hang it off
     * the side and give the page a horizontal scroll, which is the one thing the layout may not do
     * (brand.md §7). Measured rather than declared per control: what overhangs depends on how many
     * controls share the bar, how wide the word is, and how wide the screen is, and only the
     * element itself knows all three at the moment it appears.
     *
     * clientWidth rather than window.innerWidth, which counts the scrollbar the page cannot use.
     */
    #clamp() {
        const bubble = this.renderRoot.querySelector('.bubble');
        if (!bubble) return;

        bubble.style.setProperty('--nudge', '0px');
        const box = bubble.getBoundingClientRect();
        const overRight = box.right - (document.documentElement.clientWidth - EDGE_GAP_PX);
        const overLeft = EDGE_GAP_PX - box.left;

        let nudge = 0;
        if (overRight > 0) nudge = -overRight;
        else if (overLeft > 0) nudge = overLeft;
        if (nudge !== 0) bubble.style.setProperty('--nudge', `${Math.round(nudge)}px`);
    }

    render() {
        return html`
            <slot></slot>
            ${
                this.showing
                    ? html`<span class="bubble" aria-hidden="true">${this.text}</span>`
                    : nothing
            }
        `;
    }
}

customElements.define('pt-tooltip', PtTooltip);
