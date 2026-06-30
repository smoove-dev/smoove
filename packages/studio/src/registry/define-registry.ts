import type { Composition } from "@smoove/core";
import type { CompositionInput, Registry, RegistryEntry } from "../types.js";

/** Unwrap a loader result that may be a Composition or a `{ default }` module. */
function unwrap(value: Composition | { default: Composition }): Composition {
  return (value as { default?: Composition }).default ?? (value as Composition);
}

/** Resolve a {@link CompositionInput} (instance | sync/async loader) to a comp. */
function resolve(input: CompositionInput): Promise<Composition> {
  const value = typeof input === "function" ? input() : input;
  return Promise.resolve(value).then(unwrap);
}

/**
 * Build a Registry from id-keyed entries. `load(id)` is memoized so the preview
 * and an in-process render share one construction. Isomorphic — no React/DOM
 * imports — so a render worker can import it in Node.
 */
export function defineRegistry(entries: RegistryEntry[]): Registry {
  const byId = new Map<string, RegistryEntry>();
  for (const e of entries) {
    if (!e.id) throw new Error("defineRegistry: every entry needs an id");
    if (byId.has(e.id)) throw new Error(`defineRegistry: duplicate id "${e.id}"`);
    byId.set(e.id, e);
  }
  const loaded = new Map<string, Composition>();
  const pending = new Map<string, Promise<Composition>>();
  const listeners = new Set<(id: string) => void>();

  return {
    entries: () => entries,
    peek: (id) => loaded.get(id),
    update(id, composition) {
      const entry = byId.get(id);
      if (!entry) return;
      entry.composition = composition;
      loaded.delete(id);
      pending.delete(id);
      for (const fn of listeners) fn(id);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load(id) {
      const existing = loaded.get(id);
      if (existing) return Promise.resolve(existing);
      const inflight = pending.get(id);
      if (inflight) return inflight;

      const entry = byId.get(id);
      if (!entry) return Promise.reject(new Error(`Unknown composition id: ${id}`));

      const promise = resolve(entry.composition)
        .then((comp) => {
          loaded.set(id, comp);
          pending.delete(id);
          return comp;
        })
        .catch((err) => {
          pending.delete(id);
          throw err;
        });
      pending.set(id, promise);
      return promise;
    },
  };
}
