import type { Composition, ReadonlySignal } from "@konva-motion/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioDemo } from "./catalog.js";

type Signal<T> = ReadonlySignal<T> & { set(value: T): void };

/** Minimal signal matching core's `ReadonlySignal` shape (studio-local). */
function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const fn of listeners) fn(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Builds the demo's Composition and tears it down when the demo changes /
 * unmounts. The demo owns its native resolution and no longer takes a
 * container — the `<km-player>` it's handed to mounts and letterboxes it.
 *
 * Owns a per-mount props `Signal` seeded from the demo's current `values` and
 * handed to `build` — so a demo can read `props.get()` in updaters and
 * subscribe to it. `applyProps(next)` pushes a form edit into that live signal
 * WITHOUT rebuilding the composition, so the playhead frame is preserved across
 * edits. The signal is created fresh per mount and discarded on teardown.
 */
export function useComposition(
  demo: StudioDemo,
  values: Record<string, unknown>,
): {
  comp: Composition | null;
  applyProps: (next: Record<string, unknown>) => void;
} {
  const [comp, setComp] = useState<Composition | null>(null);

  // Keep the latest values available to the (demo-keyed) build effect without
  // making the effect depend on them — editing props must not rebuild.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const sigRef = useRef<Signal<Record<string, unknown>> | null>(null);

  useEffect(() => {
    const sig = createSignal<Record<string, unknown>>(valuesRef.current);
    sigRef.current = sig;

    const c = demo.build(sig);
    c.setLoop(true);
    c.play();
    setComp(c);

    // The magic: any prop edit re-renders the current frame automatically.
    // Demos just read `props.get()` in their updaters — no manual wiring.
    const unsub = sig.subscribe(() => c.refresh());

    return () => {
      unsub();
      sigRef.current = null;
      setComp(null);
      c.destroy();
    };
  }, [demo]);

  const applyProps = useCallback((next: Record<string, unknown>) => {
    sigRef.current?.set(next);
  }, []);

  return { comp, applyProps };
}
