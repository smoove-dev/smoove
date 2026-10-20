import type { Node, Root } from "fumadocs-core/page-tree";
import { source } from "./source";

type Page = NonNullable<ReturnType<typeof source.getPage>>;

/**
 * The opening of /llms.txt and /llms-full.txt. An agent asked to "make a video
 * with smoove" reads this first, so it names the one path we want it on: the
 * studio template, whose AGENTS.md carries the rest of the loop.
 */
export const AGENT_GUIDE = `# smoove

> A timeline-driven animation engine, built on top of Konva. You write a Composition in TypeScript, every animated value is a function of the frame, and the same code plays in the browser and renders to MP4 on the server.

## Making a video with a coding agent

If you were asked to make a video with smoove, work in the studio. Scaffold a studio project, then read the AGENTS.md it writes and follow it:

\`\`\`bash
npm create smoove studio my-video
cd my-video
\`\`\`

The scaffold installs the dependencies and the smoove-video skill. Load that skill before you write any composition code; if it's missing, run \`npx skills add smoove-dev/smoove -s smoove-video\`.

AGENTS.md covers the loop. In short: start the studio with \`npx smoove agent start\` and give the user the URL it prints, so they can watch. Add a video with \`npx smoove new --title "My video"\`. Check your work with \`npx smoove agent check --comp <id>\` and look at \`npx smoove agent sheet --comp <id>\` instead of rendering. Run \`npx smoove render --comp <id>\` only when the user asks for the video. The project's .mcp.json exposes the same commands as MCP tools.

Full guide: [Coding agents](/llms.mdx/docs/coding-agents). Every page below is Markdown, and [/llms-full.txt](/llms-full.txt) has all of them in one file.`;

/** The Markdown URL for a page: /docs/foo/bar is served at /llms.mdx/docs/foo/bar. */
export function markdownUrl(page: Page): string {
  return `/llms.mdx${page.url}`;
}

/** One page as Markdown: title, description, link to the rendered page, body. */
export async function pageMarkdown(page: Page): Promise<string> {
  const body = await page.data.getText("processed");
  const lines = [`# ${page.data.title}`, ""];
  if (page.data.description) lines.push(`> ${page.data.description}`, "");
  lines.push(`Source: ${page.url}`, "", body.trim());
  return lines.join("\n");
}

/** The docs index as a Markdown list, grouped by the sidebar's separators. */
export function docsIndex(tree: Root = source.getPageTree()): string {
  const out: string[] = ["## Docs"];
  const walk = (node: Node, depth: number) => {
    const pad = "  ".repeat(depth);
    if (node.type === "separator") {
      out.push("", `### ${typeof node.name === "string" ? node.name : ""}`, "");
    } else if (node.type === "page") {
      const page = source.getNodePage(node);
      if (!page) return;
      const desc = page.data.description ? `: ${page.data.description}` : "";
      out.push(`${pad}- [${page.data.title}](${markdownUrl(page)})${desc}`);
    } else {
      out.push(`${pad}- ${typeof node.name === "string" ? node.name : ""}`);
      if (node.index) walk(node.index, depth + 1);
      for (const child of node.children) walk(child, depth + 1);
    }
  };
  for (const child of tree.children) walk(child, 0);
  return out.join("\n");
}

export function textResponse(body: string, type = "text/plain", status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
