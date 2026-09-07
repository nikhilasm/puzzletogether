/**
 * A one- or two-word name for the control it wraps, shown while a pointer rests on it, for the
 * footer's icon-only toolbar (ADR-0023). Not the accessible name, which the control's own aria-label
 * carries; pointer and keyboard-focus only, since a touch browser's stuck hover would leave it over
 * the last button tapped.
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
            /* The wrapper is the flex item its control used to be, not display: contents, since the
               bubble is positioned against this box. */
            :host {
                position: relative;
                display: flex;
                box-sizing: border-box;
            }

            ::slotted(*) {
                flex: 1 1 auto;
            }

            /* Centred over the control it names, with --nudge shifting only a bubble a narrow
               viewport would push off the page (see clamp). */
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
    #onFocus = (event) => this.#showOnKeyboard(event);
    #onClick = () => this.#hide();

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
        this.addEventListener('focusin', this.#onFocus);
        this.addEventListener('focusout', this.#onLeave);
        this.addEventListener('click', this.#onClick);
    }

    /** Stops listening, so a detached wrapper cannot leave a bubble behind. */
    disconnectedCallback() {
        this.removeEventListener('pointerenter', this.#onEnter);
        this.removeEventListener('pointerleave', this.#onLeave);
        this.removeEventListener('focusin', this.#onFocus);
        this.removeEventListener('focusout', this.#onLeave);
        this.removeEventListener('click', this.#onClick);
        super.disconnectedCallback();
    }

    /** Shows the bubble, unless there is nothing to say or nothing that can hover. */
    #show() {
        if (this.text === '') return;
        if (!window.matchMedia('(hover: hover)').matches) return;
        this.showing = true;
    }

    /**
     * Shows the bubble for focus, but only keyboard focus. A mouse click focuses its control too, so
     * focus-visible is the line that gives a keyboard the reading while leaving the pointer to the
     * hover path.
     *
     * @param {FocusEvent} event The focusin, whose target is the control that gained focus.
     */
    #showOnKeyboard(event) {
        const control = /** @type {Element} */ (event.target);
        if (!control.matches(':focus-visible')) return;
        this.#show();
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
     * Shifts the bubble back inside the viewport by the overhang and no more, since a centred bubble
     * wider than its control would hang off a phone edge and give the page a horizontal scroll
     * (brand.md §7). Measured rather than declared, using clientWidth so it excludes the scrollbar.
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
