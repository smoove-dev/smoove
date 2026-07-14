import type { CompositionMeta } from "../project/types.js";
import type { EditorToolContext } from "./context.js";

/**
 * The project's compositions. Reads the filesystem on every call, so a
 * composition scaffolded earlier in THIS turn is visible to the next tool call.
 * Plain function — callable directly, no LLM required.
 */
export function listCompositions(ctx: EditorToolContext): Promise<CompositionMeta[]> {
  return ctx.project.list();
}
