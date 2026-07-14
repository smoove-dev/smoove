import { defineRegistry, type RegistryEntry } from "@smoove/studio";

/** The shape of a composition's `meta.json`. Mirrors `CompositionMeta` in
    `@smoove/editor/server` — duplicated here because this module is browser
    code and must not import the Node-only server barrel. */
type Meta = {
  id: string;
  title?: string;
  group?: string;
  description?: string;
  tags?: string[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

/**
 * The EDITOR's composition list — the agent's `editor-project/` directory, kept
 * strictly separate from `registry.ts` (the studio's built-in demo catalog,
 * which still owns `/` and `/c/:id`).
 *
 * Two globs, because the two halves have different costs: `meta.json` is a
 * cheap catalog row and is loaded EAGERLY; `composition.ts` builds a whole
 * Konva scene and stays LAZY, exactly the split RegistryEntry already models.
 *
 * When the agent writes a new composition directory, Vite's watcher sees a file
 * matching these patterns and reloads this module, so the composition appears.
 * That reload is a full page reload (glob membership is not hot-swappable) and
 * therefore drops in-memory chat history — a known Phase 2 wrinkle.
 */
const metas = import.meta.glob<Meta>("../editor-project/*/meta.json", {
  eager: true,
  import: "default",
});
const compositions = import.meta.glob("../editor-project/*/composition.ts");

function toEntries(): RegistryEntry[] {
  const entries: RegistryEntry[] = [];

  for (const [metaPath, meta] of Object.entries(metas)) {
    const dir = metaPath.slice(0, metaPath.lastIndexOf("/"));
    const load = compositions[`${dir}/composition.ts`];
    // A meta.json with no composition.ts is a half-written composition; skip it
    // rather than handing the studio an entry that can never load.
    if (!load) continue;

    entries.push({
      id: meta.id,
      title: meta.title ?? meta.id,
      group: meta.group,
      description: meta.description,
      tags: meta.tags,
      composition: load as RegistryEntry["composition"],
    });
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export default defineRegistry(toEntries());
