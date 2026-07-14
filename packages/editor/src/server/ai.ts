import { convertToModelMessages, isStepCount, streamText, type ToolSet } from "ai";
import type { AgentInput, AiRuntime, ModelInfo, ModelSpec } from "../types.js";
import type { ProjectFs } from "./project/project-fs.js";
import { smooveVideoSystemPrompt } from "./system-prompt.js";
import { type EditorToolContext, getDefaultSmooveEditorTools } from "./tools/index.js";

export type SetupAiOptions = {
  /** The filesystem-backed project the agent reads and writes. This — NOT the
      studio's demo registry — is the editor's composition list. */
  project: ProjectFs;
  /** User-selectable models, built with `defineModel`. The first is the default. */
  models: ModelSpec[];
  /** Override the toolkit. Receives the per-turn context. */
  tools?: (ctx: EditorToolContext) => ToolSet;
  /** Override the built-in system prompt (which teaches the model to write smoove). */
  system?: string;
  /** Max tool-calling steps per turn. Authoring needs room: scaffold, edit,
      typecheck, fix, typecheck again. */
  maxSteps?: number;
};

/**
 * The opinionated entry point. Transport-agnostic: returns the `streamText`
 * result and lets the host turn it into a UI message stream response — same
 * rule as `@smoove/studio/server` (NO HTTP).
 */
export function setupAi(options: SetupAiOptions): AiRuntime {
  const models = options.models;
  if (models.length === 0) throw new Error("setupAi: `models` must not be empty");

  const system = options.system ?? smooveVideoSystemPrompt;
  const maxSteps = options.maxSteps ?? 32;
  const makeTools = options.tools ?? getDefaultSmooveEditorTools;

  // `models` is non-empty (checked above), so `[0]` is always defined.
  const pick = (id?: string): ModelSpec =>
    models.find((m) => m.id === id) ?? (models[0] as ModelSpec);

  return {
    models(): ModelInfo[] {
      return models.map(({ id, label }) => ({ id, label }));
    },

    async stream(input: AgentInput, signal?: AbortSignal) {
      const spec = pick(input.modelId);
      const tools = makeTools({ project: options.project, context: input.context });

      return streamText({
        model: spec.model,
        system,
        messages: await convertToModelMessages(input.messages),
        tools,
        stopWhen: isStepCount(maxSteps),
        abortSignal: signal,
      });
    },
  };
}
