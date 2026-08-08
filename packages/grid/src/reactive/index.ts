/**
 * The single place the signal implementation is imported.
 *
 * Every other file in core goes through here, which is what made it a one-file
 * change to drop `@lit-labs/signals` for its own leaking mixin — see
 * {@link SignalWatcher}. The primitives below come straight from the TC39
 * proposal's polyfill and are swappable for the native API when it ships.
 */
import { Signal } from 'signal-polyfill';

export { SignalWatcher } from './signal-watcher.js';

export interface ReadableSignal<T> {
  get(): T;
}

export interface WritableSignal<T> extends ReadableSignal<T> {
  set(value: T): void;
}

export function signal<T>(value: T): WritableSignal<T> {
  return new Signal.State(value);
}

/**
 * Lazily recomputed and memoised: the body runs only when something reads it and
 * a dependency has actually changed. This is what keeps the projection and layout
 * off the hot path for value-only updates — nothing invalidates them, so nothing
 * recomputes.
 */
export function computed<T>(fn: () => T): ReadableSignal<T> {
  return new Signal.Computed(fn);
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
