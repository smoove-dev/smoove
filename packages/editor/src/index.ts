/** @smoove/editor — public barrel (browser). Server lives at "@smoove/editor/server". */
import { ChatRail } from "./components/chat/chat-rail.js";

/** Compound namespace, mirroring `Studio`. Compose the regions you want. */
export const Editor = {
  ChatRail,
};

export { ChatRail, type ChatRailProps } from "./components/chat/chat-rail.js";
export { useEditorContext } from "./hooks/use-editor-context.js";
export type * from "./types.js";
