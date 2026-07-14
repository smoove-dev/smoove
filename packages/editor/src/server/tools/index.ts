import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { listCompositions } from "./compositions.js";
import type { EditorToolContext } from "./context.js";
import { getTimeline } from "./timeline.js";

/** The opinionated default toolkit. Phase 1 is read-only; Phase 2 adds the
    ProjectFs-backed write tools (readFile/writeFile/editFile/scaffold/typecheck).
    Annotated as `ToolSet` so the emitted d.ts doesn't leak @ai-sdk internals. */
export function getDefaultSmooveEditorTools(ctx: EditorToolContext): ToolSet {
  return {
    listCompositions: tool({
      description: "List the compositions in the project's registry.",
      inputSchema: z.object({}),
      execute: async () => listCompositions(ctx),
    }),
    getTimeline: tool({
      description:
        "Get the active composition's timeline: current frame, fps, total duration, and each sequence's frame range.",
      inputSchema: z.object({}),
      execute: async () => getTimeline(ctx),
    }),
  };
}

export type EditorToolSet = ReturnType<typeof getDefaultSmooveEditorTools>;

export { type CompositionSummary, listCompositions } from "./compositions.js";
export type { EditorToolContext } from "./context.js";
export { getTimeline } from "./timeline.js";
