import type { ReadonlySignal } from "@konva-motion/core";

export type { ReadonlySignal };

export type Signal<T> = ReadonlySignal<T> & {
  set(value: T): void;
};

/**
 * Minimal reactive value, shape-compatible with core's `ReadonlySignal`.
 * The player owns its own stable signals (frame, playing, fullscreen, scale,
 * …) so descendant components can subscribe once and keep working even as the
 * underlying `Composition` is swapped in or out.
 */
export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const fn of listeners) fn(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
