import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import type { Config } from "@react-router/dev/config";

// The site is fully static: every page, the search index and the agent
// Markdown files are rendered to files at build time, and Cloudflare serves
// them as plain assets. No server code runs per request.

const CONTENT = join(import.meta.dirname, "content/docs");

/** Every docs URL, from the MDX files: `layout/index.mdx` → `/docs/layout`. */
function docsUrls(): string[] {
  const urls: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mdx")) {
        const slug = relative(CONTENT, full)
          .replace(/\.mdx$/, "")
          .replace(/(^|\/)index$/, "");
        urls.push(slug ? `/docs/${slug}` : "/docs");
      }
    }
  };
  walk(CONTENT);
  return urls.sort();
}

export default {
  appDirectory: "src",
  ssr: false,
  // The build tool is @react-router/dev 7 but the runtime is react-router 8,
  // which names data files the v8 way (`/_.data`, not `/_root.data`). Without
  // this, pre-rendering asks the v8 runtime for v7 file names and gets 404s.
  future: { v8_trailingSlashAwareDataRequests: true },
  async prerender() {
    const docs = docsUrls();
    return [
      "/",
      "/docs",
      ...docs,
      "/api/search",
      "/llms.txt",
      "/llms-full.txt",
      // Each page as Markdown. The `.md` ending lets `/llms.mdx/docs/code.md`
      // and the `/llms.mdx/docs/code/` folder sit side by side as files.
      ...docs.map((url) => `/llms.mdx${url}.md`),
    ];
  },
  async buildEnd({ reactRouterConfig }) {
    const client = join(reactRouterConfig.buildDirectory, "client");

    // Unknown URLs get the SPA shell with a 404 status; it boots the router,
    // which renders the docs "Page not found" boundary.
    const fallback = join(client, "__spa-fallback.html");
    if (existsSync(fallback)) copyFileSync(fallback, join(client, "404.html"));

    // Pre-rendering also writes a `.data` copy of every non-page file (the
    // search index, the agent text files). Pages never request them.
    for (const file of ["api/search", "llms.txt", "llms-full.txt"]) {
      rmSync(join(client, `${file}.data`), { force: true });
    }
    for (const url of docsUrls()) rmSync(join(client, `llms.mdx${url}.md.data`), { force: true });

    const redirects: string[] = [];
    // `/docs` pre-renders to a "Redirecting…" page with a 2-second meta
    // refresh; send a real redirect to the same page instead.
    const docsIndex = readFileSync(join(client, "docs/index.html"), "utf8");
    const target = docsIndex.match(/http-equiv="refresh" content="\d+;url=([^"]+)"/)?.[1];
    if (target) redirects.push(`/docs ${target} 302`, `/docs/ ${target} 302`);
    // The Markdown pages used to live at /llms.mdx/docs/<slug>; keep those
    // links working. One static rule per page (the free plan allows 2,000).
    for (const url of docsUrls()) redirects.push(`/llms.mdx${url} /llms.mdx${url}.md 301`);
    writeFileSync(join(client, "_redirects"), `${redirects.join("\n")}\n`);
  },
} satisfies Config;
