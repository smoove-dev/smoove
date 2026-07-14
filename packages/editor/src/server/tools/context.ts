import type { EditorContext } from "../../types.js";
import type { ProjectFs } from "../project/project-fs.js";

/**
 * What every tool is handed.
 *
 * `project` is the filesystem-backed project — the source of the EDITOR's
 * composition list, deliberately NOT the studio's built-in demo registry.
 * `context` is the per-turn browser snapshot (only the browser knows the
 * playhead) and is absent when a tool is called directly, outside a
 * conversation.
 */
export type EditorToolContext = {
  project: ProjectFs;
  context?: EditorContext;
};
