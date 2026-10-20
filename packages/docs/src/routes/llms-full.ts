import { AGENT_GUIDE, pageMarkdown, textResponse } from "../lib/llms";
import { source } from "../lib/source";

// /llms-full.txt: the agent guide, then every docs page as Markdown.
export async function loader() {
  const pages = await Promise.all(source.getPages().map(pageMarkdown));
  return textResponse([AGENT_GUIDE, ...pages].join("\n\n---\n\n"));
}
