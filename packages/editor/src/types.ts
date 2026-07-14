/** @smoove/editor — the shared browser↔server contract. No React, no Node. */
import type { LanguageModel, UIMessage } from "ai";

/** Optional metadata for `defineModel`. Everything is derived when omitted. */
export type ModelMeta = {
  /** Stable key the browser sends back. Defaults to `<provider>/<modelId>`. */
  id?: string;
  /** Display name in the picker. Defaults to the id. */
  label?: string;
  description?: string;
};

/** A model the app offers. Build these with `defineModel`; the end user picks
    one in the chat rail's PromptInputSelect. `model` is any AI SDK
    `LanguageModel` — a provider instance or a gateway id string. */
export type ModelSpec = {
  /** Stable key the browser sends back to select this model. */
  id: string;
  /** Display name in the picker. */
  label: string;
  description?: string;
  model: LanguageModel;
};

/** The key-free projection of a ModelSpec that is safe to send to the browser. */
export type ModelInfo = Pick<ModelSpec, "id" | "label">;

/** A sequence's range within the composition, in frames. */
export type SequenceInfo = {
  name: string;
  from: number;
  durationInFrames: number;
};

/** The live snapshot the browser sends each turn — only it knows the playhead. */
export type EditorContext = {
  compositionId: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  sequences: SequenceInfo[];
};

/** The extra `body` the chat rail attaches to each `sendMessage`. */
export type EditorChatBody = {
  modelId?: string;
  context?: EditorContext;
};

/** What the agent endpoint receives: useChat's UIMessages + our extra body. */
export type AgentInput = EditorChatBody & {
  messages: UIMessage[];
};

/** The `streamText` return type, without re-deriving its generics. */
export type StreamTextResultOf = ReturnType<typeof import("ai").streamText>;

/** Transport-agnostic runtime. The host wraps `stream()` in a UI message
    stream response — same rule as `@smoove/studio/server`: NO HTTP here. */
export type AiRuntime = {
  /** Key-free model list for the picker. */
  models(): ModelInfo[];
  /** Returns the raw `streamText` result; the host converts it to a response. */
  stream(input: AgentInput, signal?: AbortSignal): Promise<StreamTextResultOf>;
};
