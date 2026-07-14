import type { EditorContext } from "../../types.js";
import type { EditorToolContext } from "./context.js";

/** Plain function — returns the browser's per-turn snapshot of the playhead.
    Throws when called outside a conversation (no snapshot was supplied). */
export function getTimeline(ctx: EditorToolContext): EditorContext {
  if (!ctx.context) {
    throw new Error("No editor context for this turn — the timeline is unknown.");
  }
  return ctx.context;
}
