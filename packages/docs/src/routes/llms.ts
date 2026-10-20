import { AGENT_GUIDE, docsIndex, textResponse } from "../lib/llms";

// /llms.txt: how an agent should make a video, then the docs index.
export function loader() {
  return textResponse(`${AGENT_GUIDE}\n\n${docsIndex()}\n`);
}
