import type { WritableSignal } from "../types.js";

/**
 * A minimal writable signal matching core's `ReadonlySignal` shape (get +
 * subscribe) plus `set`. React-free and Node-safe. An entry's `load` receives
 * the readable side and reads `props.get()` in updaters / subscribes to re-apply
 * the current frame; the studio holds the writable side and pushes form edits.
 */
export function createPropsSignal<T>(initial: T): WritableSignal<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const fn of listeners) fn(value);
    },
    subscribe(listener: (v: T) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
