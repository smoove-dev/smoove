import type { Composition, ReadonlySignal } from "@konva-motion/core";
import type { Registry, RegistryEntry } from "../types.js";

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

  return {
    entries: () => entries,
    peek: (id) => loaded.get(id),
    load(id, props) {
      const existing = loaded.get(id);
      if (existing) return Promise.resolve(existing);
      const inflight = pending.get(id);
      if (inflight) return inflight;

      const entry = byId.get(id);
      if (!entry) return Promise.reject(new Error(`Unknown composition id: ${id}`));

      const promise = Promise.resolve(entry.load(props as ReadonlySignal<Record<string, unknown>>))
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
