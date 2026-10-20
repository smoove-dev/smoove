import type { Composition } from "@smoove/core";
import type { CompositionInput, Registry, RegistryEntry, RegistryProblem } from "../types.js";

/** Unwrap a loader result that may be a Composition or a `{ default }` module. */
function unwrap(value: Composition | { default: Composition }): Composition {
  return (value as { default?: Composition }).default ?? (value as Composition);
}

/** Resolve a {@link CompositionInput} (instance | sync/async loader) to a comp. */
function resolve(input: CompositionInput): Promise<Composition> {
  const value = typeof input === "function" ? input() : input;
  return Promise.resolve(value).then(unwrap);
}

/** Where the registry came from, when the studio found it on disk. */
export interface RegistrySources {
  /** The folder under `compositions/` each entry came from, in the same order. */
  folders?: string[];
  /** Folders under `compositions/` with no index file. */
  missing?: string[];
}

/**
 * Build a Registry from id-keyed entries. `load(id)` is memoized so the preview
 * and an in-process render share one construction. Isomorphic — no React/DOM
 * imports — so a render worker can import it in Node.
 *
 * With `sources.folders` (the studio's own discovery), a duplicate id is a
 * problem naming both folders and the later entry is left out, instead of an
 * error that would take the whole studio down. Each problem is logged once.
 */
export function defineRegistry(entries: RegistryEntry[], sources?: RegistrySources): Registry {
  const byId = new Map<string, RegistryEntry>();
  const folderOf = new Map<string, string>();
  const kept: RegistryEntry[] = [];
  const problems: RegistryProblem[] = [];
  const folders = sources?.folders;
  entries.forEach((e, i) => {
    if (!e.id) throw new Error("defineRegistry: every entry needs an id");
    const folder = folders?.[i];
    if (byId.has(e.id)) {
      if (folder === undefined) throw new Error(`defineRegistry: duplicate id "${e.id}"`);
      problems.push({
        level: "error",
        message: `compositions/${folderOf.get(e.id)} and compositions/${folder} both use the id "${e.id}". The studio shows compositions/${folderOf.get(e.id)} and leaves the other out until one of them changes its id.`,
      });
      return;
    }
    byId.set(e.id, e);
    kept.push(e);
    if (folder === undefined) return;
    folderOf.set(e.id, folder);
    if (folder !== e.id) {
      problems.push({
        level: "warning",
        message: `compositions/${folder} has the id "${e.id}". Name the folder after the id so they're easy to find.`,
      });
    }
  });
  for (const folder of sources?.missing ?? []) {
    problems.push({
      level: "error",
      message: `compositions/${folder} has no index.ts, so the studio can't show it. Add an index.ts that default-exports the composition's entry.`,
    });
  }
  for (const p of problems)
    (p.level === "error" ? console.error : console.warn)(`[smoove] ${p.message}`);

  const loaded = new Map<string, Composition>();
  const pending = new Map<string, Promise<Composition>>();
  const listeners = new Set<(id: string) => void>();

  return {
    entries: () => kept,
    problems: () => problems,
    peek: (id) => loaded.get(id),
    update(id, composition, checks, props) {
      const entry = byId.get(id);
      if (!entry) return;
      entry.composition = composition;
      if (checks) entry.checks = checks;
      if (props) {
        entry.propsSchema = props.propsSchema;
        entry.defaultProps = props.defaultProps;
      }
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
