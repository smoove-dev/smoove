import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineModel, type ModelSpec, ProjectFs, setupAi } from "@smoove/editor/server";

/** The editor's project: a real directory the agent reads and writes. This is
    the editor's composition list — deliberately NOT the demo registry that
    powers `/` and `/c/:id`. Gitignored scratch; created on first use. */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../editor-project",
);

export const project = new ProjectFs(projectRoot);

/** Lazily constructed so a missing key surfaces as a request error rather than
    crashing the dev server at import time. */
let cached: ReturnType<typeof setupAi> | null = null;

function buildModels(): ModelSpec[] {
  const models: ModelSpec[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    models.push(defineModel(anthropic("claude-opus-4-8"), { label: "Claude Opus 4.8" }));
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    models.push(defineModel(google("gemini-2.5-pro"), { label: "Gemini 2.5 Pro" }));
  }

  const baseURL = process.env.SMOOVE_LOCAL_BASE_URL;
  const localModel = process.env.SMOOVE_LOCAL_MODEL;
  if (baseURL && localModel) {
    const local = createOpenAICompatible({ name: "local", baseURL });
    models.push(defineModel(local.chatModel(localModel), { label: `${localModel} (local)` }));
  }

  if (models.length === 0) {
    throw new Error("No model configured — set ANTHROPIC_API_KEY or SMOOVE_LOCAL_BASE_URL.");
  }
  return models;
}

export async function getAi() {
  if (!cached) {
    await project.init();
    cached = setupAi({ project, models: buildModels() });
  }
  return cached;
}
