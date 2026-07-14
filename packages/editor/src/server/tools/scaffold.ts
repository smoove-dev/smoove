import type { ScaffoldResult, ScaffoldSpec } from "../project/types.js";
import type { EditorToolContext } from "./context.js";

/**
 * Create a new composition: `<id>/meta.json` + a minimal, valid
 * `<id>/composition.ts` (right size, right clock, empty black stage). Author the
 * actual motion afterwards with `editFile`. Plain function.
 */
export function scaffoldComposition(
  ctx: EditorToolContext,
  spec: ScaffoldSpec,
): Promise<ScaffoldResult> {
  return ctx.project.scaffold(spec);
}
