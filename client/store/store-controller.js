/**
 * The bridge between `RoomStore` and Lit: a `ReactiveController` that re-renders its host when the
 * slice of state that host cares about changes.
 *
 * The selector matters for more than tidiness. Focus updates arrive at ~10/s per player, and a
 * component subscribed to the whole store would re-render on every one (architecture.md §6).
 */

/**
 * @typedef {import('lit').ReactiveControllerHost} ReactiveControllerHost
 */

/** Whether a selected slice changed, comparing element-wise when the selector returns an array. */
function hasChanged(previous, next) {
    if (Array.isArray(previous) && Array.isArray(next)) {
        return previous.length !== next.length || previous.some((item, i) => item !== next[i]);
    }
    return previous !== next;
}

export class StoreController {
    #host;
    #store;
    #select;
    #slice;
    #unsubscribe = null;

    /**
     * @param {ReactiveControllerHost} host - The element to update.
     * @param {import('./room-store.js').RoomStore} store - The store to read.
     * @param {(state: object) => any} [select] - Picks the slice this host depends on. Return an
     *   array to depend on several slices; it is compared element-wise. Defaults to the whole
     *   state, which re-renders on every change.
     */
    constructor(host, store, select = (state) => state) {
        this.#host = host;
        this.#store = store;
        this.#select = select;
        this.#slice = select(store.state);
        host.addController(this);
    }

    /** The current state. Components read what they need; the selector governs when they update. */
    get state() {
        return this.#store.state;
    }

    /** The store itself, for components that dispatch intent straight to it. */
    get store() {
        return this.#store;
    }

    /** Subscribes on connect, requesting an update only when the selected slice actually changed. */
    hostConnected() {
        this.#unsubscribe = this.#store.subscribe((state) => {
            const next = this.#select(state);
            if (!hasChanged(this.#slice, next)) return;
            this.#slice = next;
            this.#host.requestUpdate();
        });
    }

    /** Drops the subscription so a removed element cannot keep the store alive. */
    hostDisconnected() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
    }
}
