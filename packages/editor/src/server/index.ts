/** @smoove/editor/server — Node-only. Contracts + runtime + toolkit, NO HTTP.
    The host app wires the transport (see kitchen-sink's routes/api.agent.ts).

    Every tool is exported twice: as part of getDefaultSmooveEditorTools() for
    the agent, and as a plain function you can call directly. */

export type * from "../types.js";
export { type SetupAiOptions, setupAi } from "./ai.js";
export { defineModel } from "./models.js";
export { ProjectFs } from "./project/project-fs.js";
export type * from "./project/types.js";
export { smooveVideoSystemPrompt } from "./system-prompt.js";
export {
  type EditFileInput,
  type EditorToolContext,
  type EditorToolSet,
  editFile,
  getDefaultSmooveEditorTools,
  getTimeline,
  listCompositions,
  type ReadFileInput,
  readFile,
  scaffoldComposition,
  typecheck,
  type WriteFileInput,
  writeFile,
} from "./tools/index.js";
