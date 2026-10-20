import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// Documentation collection. MDX bodies + meta.json folders live under
// `content/docs`; the sidebar tree, ordering, and grouping are derived from the
// folder structure + meta.json (replacing the old frontmatter `group`/`order`).
export const docs = defineDocs({
  dir: "content/docs",
  // Keep each page's processed Markdown, so /llms-full.txt and the per-page
  // Markdown routes can hand agents plain text instead of a rendered page.
  docs: {
    postprocess: {
      includeProcessedMarkdown: {
        headingIds: false,
        // What each MDX component becomes in the Markdown copy. Callouts and
        // Prop entries carry meaning in their attributes, so they stay as JSX.
        // Live demos and the props playground are canvases with nothing to
        // read, so they go. Layout wrappers (Tabs, Steps, Badge) keep only
        // their content. remark-llms replaces any `filterElement` with its own,
        // so this sets the stringifier's `_stringify` flag on the node instead.
        stringify(node) {
          if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;
          if (node.name === "Callout" || node.name === "Prop") return;
          const drop = node.name === "Demo" || node.name === "PropsPlayground";
          node.data = {
            ...node.data,
            _stringify: drop ? { text: "" } : "children-only",
          } as typeof node.data;
          return undefined;
        },
      },
    },
  },
});

export default defineConfig();
