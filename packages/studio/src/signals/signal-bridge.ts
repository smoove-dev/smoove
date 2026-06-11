import type { ReadonlySignal } from "@konva-motion/core";
import { useCallback, useSyncExternalStore } from "react";
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

/**
 * Bridge a core/player `ReadonlySignal` (get + subscribe) into React. Used for
 * the player's playback state (`comp.frame`, `state.scale`, …) and the studio's
 * per-composition props signal.
 */
export function usePlayerSignal<T>(signal: ReadonlySignal<T>): T {
  return useSyncExternalStore(
    (onStoreChange) => signal.subscribe(() => onStoreChange()),
    () => signal.get(),
    () => signal.get(),
  );
}
