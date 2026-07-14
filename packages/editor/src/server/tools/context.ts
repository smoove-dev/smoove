import type { Registry } from "@smoove/studio";
import type { EditorContext } from "../../types.js";

/** What every tool is handed. `context` is the per-turn browser snapshot and is
    absent when a tool is called directly, outside a conversation. */
export type EditorToolContext = {
  registry: Registry;
  context?: EditorContext;
};
