import type { TypecheckResult } from "../project/types.js";
import type { EditorToolContext } from "./context.js";

/**
 * Typecheck every composition in the project. Plain function — this is the
 * agent's self-correction signal, so it runs the real compiler, not a
 * syntax-only transform.
 */
export function typecheck(ctx: EditorToolContext): Promise<TypecheckResult> {
  return ctx.project.typecheck();
}
