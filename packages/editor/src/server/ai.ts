import type { Registry } from "@smoove/studio";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import type { AgentInput, AiRuntime, ModelInfo, ModelSpec } from "../types.js";
import { type EditorToolContext, getDefaultSmooveEditorTools } from "./tools/index.js";

export type SetupAiOptions = {
  /** The composition catalog the tools read. */
  registry: Registry;
  /** User-selectable models, built with `defineModel`. The first is the default. */
  models: ModelSpec[];
  /** Override the toolkit. Receives the per-turn context. */
  tools?: (ctx: EditorToolContext) => Record<string, unknown>;
  /** Override the built-in system prompt. Phase 2 injects the smoove-video skill. */
  system?: string;
  /** Max tool-calling steps per turn. */
  maxSteps?: number;
};

const DEFAULT_SYSTEM = [
  "You are smoove, an assistant that authors timeline-driven Konva animations.",
  "Use listCompositions and getTimeline to ground yourself before answering.",
  "You cannot edit files yet — answer conversationally and concisely.",
].join("\n");

/**
 * The opinionated entry point. Transport-agnostic: returns the `streamText`
 * result and lets the host turn it into a UI message stream response — same
 * rule as `@smoove/studio/server` (NO HTTP).
 */
export function setupAi(options: SetupAiOptions): AiRuntime {
  const models = options.models;
  if (models.length === 0) throw new Error("setupAi: `models` must not be empty");

  const system = options.system ?? DEFAULT_SYSTEM;
  const maxSteps = options.maxSteps ?? 16;
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
      const tools = makeTools({ registry: options.registry, context: input.context });

      return streamText({
        model: spec.model,
        system,
        messages: await convertToModelMessages(input.messages),
        tools: tools as Parameters<typeof streamText>[0]["tools"],
        stopWhen: isStepCount(maxSteps),
        abortSignal: signal,
      });
    },
  };
}
