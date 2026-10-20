import type { ReadonlySignal } from "@smoove/core";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Signal } from "signal-polyfill";

type AnySignal<T> = Signal.State<T> | Signal.Computed<T>;

/**
 * Bridge a signal-polyfill `Signal.State`/`Signal.Computed` into React. A
 * `Watcher` notifies once and then stops until re-armed, so its callback must
 * NOT read signals — it schedules a microtask that tells React to re-read the
 * snapshot and re-arms the watcher.
 */
export function useSignalValue<T>(signal: AnySignal<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let disposed = false;
      const watcher = new Signal.subtle.Watcher(() => {
        if (disposed) return;
        queueMicrotask(() => {
          if (disposed) return;
          onStoreChange();
          watcher.watch(); // re-arm: the watcher stops after each notification
        });
      });
      watcher.watch(signal);
      return () => {
        disposed = true;
        watcher.unwatch(signal);
      };
    },
    [signal],
  );
  const getSnapshot = useCallback(() => signal.get(), [signal]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let holds = 0;
const missed = new Set<() => void>();

/**
 * Keep React on the player-signal values it last read until the returned
 * release is called. An agent's snapshot, sheet or check drives the
 * composition through many frames with only microtasks between them, and
 * each frame would be a synchronous React update: past 50 in a row React
 * throws "Maximum update depth exceeded". On release, every hook that missed
 * a change re-reads once. Releasing twice is a no-op.
 */
export function holdPlayerSignals(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds > 0) return;
    const notify = [...missed];
    missed.clear();
    for (const fn of notify) fn();
  };
}

/** A `useSyncExternalStore` source over `signal` that respects {@link holdPlayerSignals}. */
export function playerSignalStore<T>(signal: ReadonlySignal<T>): {
  subscribe(onStoreChange: () => void): () => void;
  getSnapshot(): T;
} {
  let seen: { value: T } | null = null;
  return {
    subscribe(onStoreChange) {
      const unsubscribe = signal.subscribe(() => {
        if (holds > 0) missed.add(onStoreChange);
        else onStoreChange();
      });
      return () => {
        missed.delete(onStoreChange);
        unsubscribe();
      };
    },
    getSnapshot() {
      if (holds > 0 && seen) return seen.value;
      const value = signal.get();
      seen = { value };
      return value;
    },
  };
}

/**
 * Bridge a core/player `ReadonlySignal` (get + subscribe) into React. Used for
 * the player's playback state (`comp.frame`, `state.scale`, …) and the studio's
 * per-composition props signal.
 */
export function usePlayerSignal<T>(signal: ReadonlySignal<T>): T {
  const store = useMemo(() => playerSignalStore(signal), [signal]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
