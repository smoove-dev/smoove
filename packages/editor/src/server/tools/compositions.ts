import type { EditorToolContext } from "./context.js";

export type CompositionSummary = {
  id: string;
  title?: string;
  group?: string;
  description?: string;
  tags?: string[];
};

/** Plain function — callable directly, no LLM required. */
export function listCompositions(ctx: EditorToolContext): CompositionSummary[] {
  return ctx.registry.entries().map((e) => ({
    id: e.id,
    title: e.title,
    group: e.group,
    description: e.description,
    tags: e.tags,
  }));
}
