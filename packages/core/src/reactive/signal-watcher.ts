import { LitElement } from 'lit';
import { Signal } from 'signal-polyfill';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixin constraint
type Constructor<T> = new (...args: any[]) => T;

/**
 * Re-renders an element when a signal it read during render changes.
 *
 * This replaces the mixin from `@lit-labs/signals`, which leaks every element it
 * is applied to. That version registers the element with a FinalizationRegistry
 * whose held value contains the watcher, and separately keeps a
 * `WeakMap<watcher, element>`. The registry strongly retains the watcher, the
 * live watcher keeps the WeakMap entry alive, and that entry strongly retains the
 * element — so the element is collectable only once the registry fires, and the
 * registry fires only once the element is collected. Nothing is ever freed.
 *
 * Measured at 0.1.3 and 0.3.0: 50 of 50 disconnected elements retained, including
 * ones that read no signals at all, costing ~20MB per scroll pass over a grid of
 * 5,000 rows.
 *
 * The fix is to hold the element through a WeakRef instead, so a watcher that
 * outlives its element cannot pin it. Everything else follows the same shape:
 * an internal version signal forces the computed to re-run on each update, and a
 * flag stops our own version bump being mistaken for an external change.
 */
export function SignalWatcher<T extends Constructor<LitElement>>(Base: T): T {
  // Cast through a concrete base: TypeScript cannot see inherited members
  // through a type parameter, so a mixin body needs a real class to extend.
  class SignalWatcherElement extends (Base as Constructor<LitElement>) {
    /** Bumped before each update so the computed cannot serve a cached value. */
    readonly #version = new Signal.State(0);
    #computed: Signal.Computed<void> | undefined;
    #watcher: Signal.subtle.Watcher | undefined;
    #selfUpdate = false;

    #arm(): void {
      if (this.#watcher !== undefined) return;

      this.#computed = new Signal.Computed(() => {
        this.#version.get();
        super.performUpdate();
      });

      const ref = new WeakRef(this);
      const watcher = new Signal.subtle.Watcher(function (this: Signal.subtle.Watcher) {
        const element = ref.deref();
        if (element === undefined) return;
        // A notification caused by our own version bump is not a change worth
        // reacting to; reacting would schedule an update from inside an update.
        if (element.#selfUpdate === false) element.requestUpdate();
        // A watcher stops notifying after it fires, so re-arm for the next change.
        this.watch();
      });

      watcher.watch(this.#computed);
      this.#watcher = watcher;
    }

    #disarm(): void {
      if (this.#watcher !== undefined && this.#computed !== undefined) {
        this.#watcher.unwatch(this.#computed);
      }
      this.#watcher = undefined;
      this.#computed = undefined;
    }

    override performUpdate(): void {
      if (!this.isUpdatePending) return;
      this.#arm();

      this.#selfUpdate = true;
      this.#version.set(this.#version.get() + 1);
      this.#selfUpdate = false;

      // Running the update inside the computed is what records the signals the
      // render read, so the next change to any of them re-renders this element
      // and nothing above it.
      this.#computed?.get();
    }

    override connectedCallback(): void {
      super.connectedCallback();
      // Re-arms after a move, since disconnecting disposes the watcher.
      this.requestUpdate();
    }

    override disconnectedCallback(): void {
      super.disconnectedCallback();
      // Deferred: a move within the DOM disconnects and reconnects in the same
      // task, and that should not tear the watcher down.
      queueMicrotask(() => {
        if (!this.isConnected) this.#disarm();
      });
    }
  }

  return SignalWatcherElement as unknown as T;
}
