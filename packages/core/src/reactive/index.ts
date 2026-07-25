/**
 * The single place `@lit-labs/signals` is imported.
 *
 * That package is still labs, which is a real risk for a published library. Every
 * other file in core imports from here, so swapping the implementation — for the
 * TC39 proposal once it lands, or for something else entirely — touches one file.
 */
import { computed as labsComputed, signal as labsSignal } from '@lit-labs/signals';

export { SignalWatcher, watch } from '@lit-labs/signals';

export interface ReadableSignal<T> {
  get(): T;
}

export interface WritableSignal<T> extends ReadableSignal<T> {
  set(value: T): void;
}

export function signal<T>(value: T): WritableSignal<T> {
  return labsSignal(value);
}

/**
 * Lazily recomputed and memoised: the body runs only when something reads it and
 * a dependency has actually changed. This is what keeps the projection and layout
 * off the hot path for value-only updates — nothing invalidates them, so nothing
 * recomputes.
 */
export function computed<T>(fn: () => T): ReadableSignal<T> {
  return labsComputed(fn);
}

/** A monotonic counter used to invalidate computeds on structural change. */
export class Version {
  private readonly counter = signal(0);

  get(): number {
    return this.counter.get();
  }

  bump(): void {
    this.counter.set(this.counter.get() + 1);
  }
}
