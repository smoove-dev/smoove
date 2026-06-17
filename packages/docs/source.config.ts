import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// Documentation collection. MDX bodies + meta.json folders live under
// `content/docs`; the sidebar tree, ordering, and grouping are derived from the
// folder structure + meta.json (replacing the old frontmatter `group`/`order`).
export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
