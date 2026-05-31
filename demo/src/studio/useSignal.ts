import type { ReadonlySignal } from "@konva-motion/core";
import { useSyncExternalStore } from "react";

/**
 * Bind a konva-motion `ReadonlySignal` to React. Re-renders the calling
 * component whenever the signal changes. Values are primitives (number /
 * boolean) so referential identity is stable.
 */
export function useSignal<T>(signal: ReadonlySignal<T>): T {
  return useSyncExternalStore(
    (onChange) => signal.subscribe(onChange),
    () => signal.get(),
  );
}
