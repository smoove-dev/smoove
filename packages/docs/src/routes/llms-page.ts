import { pageMarkdown, textResponse } from "../lib/llms";
import { source } from "../lib/source";
import type { Route } from "./+types/llms-page";

// /llms.mdx/docs/<slug>: one docs page as Markdown.
export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params["*"].split("/").filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) return textResponse("Not found\n", "text/plain", 404);
  return textResponse(await pageMarkdown(page), "text/markdown");
}
