import type { LanguageModel } from "ai";
import type { ModelMeta, ModelSpec } from "../types.js";

/**
 * Attach picker metadata to any AI SDK model. Bring your own provider —
 * configure it however the SDK lets you:
 *
 *   defineModel(anthropic("claude-opus-4-8"))
 *   defineModel(google("gemini-2.5-pro"), { label: "Gemini 2.5 Pro" })
 *   defineModel(ornith.chatModel("ornith-1.0"), { label: "Ornith 1.0 (local)" })
 *   defineModel("openai/gpt-4o")            // gateway model id string
 *
 * `id` defaults to `<provider>/<modelId>` (or the string itself), and `label`
 * defaults to `id`, so the common case needs no metadata at all.
 */
export function defineModel(model: LanguageModel, meta: ModelMeta = {}): ModelSpec {
  const derived = typeof model === "string" ? model : `${model.provider}/${model.modelId}`;
  const id = meta.id ?? derived;
  return { id, label: meta.label ?? id, description: meta.description, model };
}
