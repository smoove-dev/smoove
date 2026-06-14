import matter from "gray-matter";
import { type Heading, renderMarkdown } from "./markdown.server";

export interface DocMeta {
  slug: string;
  title: string;
  group: string;
  order: number;
  eyebrow?: string;
  description?: string;
  icon?: string;
}

export interface DocPage {
  meta: DocMeta;
  html: string;
  headings: Heading[];
}

export interface NavGroup {
  label: string;
  items: DocMeta[];
}

// Order groups appear in the sidebar. Groups not listed are appended after, in
// first-seen order.
const GROUP_ORDER = ["Getting Started", "Core Concepts", "Components", "API Reference"];

// Bundle every Markdown page as a raw string. Works in SSR dev + build and
// sidesteps fs path resolution. Each file declares its metadata in frontmatter.
const rawModules = import.meta.glob("../content/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

interface ParsedDoc {
  meta: DocMeta;
  body: string;
}

function fileSlug(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "").replace(/^\d+[-_]/, "");
}

function filePrefixOrder(path: string): number {
  const base = path.split("/").pop() ?? path;
  const m = base.match(/^(\d+)[-_]/);
  return m?.[1] ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

const docs: ParsedDoc[] = Object.entries(rawModules)
  .map(([path, raw]) => {
    const { data, content } = matter(raw);
    const slug = typeof data.slug === "string" ? data.slug : fileSlug(path);
    const order = typeof data.order === "number" ? data.order : filePrefixOrder(path);
    const meta: DocMeta = {
      slug,
      title: typeof data.title === "string" ? data.title : slug,
      group: typeof data.group === "string" ? data.group : "Docs",
      order,
      eyebrow: typeof data.eyebrow === "string" ? data.eyebrow : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
      icon: typeof data.icon === "string" ? data.icon : undefined,
    };
    return { meta, body: content };
  })
  .sort((a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title));

const pageCache = new Map<string, DocPage>();

export function getAllDocs(): DocMeta[] {
  return docs.map((d) => d.meta);
}

export function getFirstDocSlug(): string | undefined {
  return docs[0]?.meta.slug;
}

export function getDoc(slug: string): DocPage | null {
  const cached = pageCache.get(slug);
  if (cached) return cached;
  const found = docs.find((d) => d.meta.slug === slug);
  if (!found) return null;
  const { html, headings } = renderMarkdown(found.body);
  const page: DocPage = { meta: found.meta, html, headings };
  pageCache.set(slug, page);
  return page;
}

export function buildNav(): NavGroup[] {
  const groups = new Map<string, DocMeta[]>();
  for (const { meta } of docs) {
    const list = groups.get(meta.group) ?? [];
    list.push(meta);
    groups.set(meta.group, list);
  }
  const ordered = [...groups.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return ordered.map((label) => ({ label, items: groups.get(label) ?? [] }));
}

export function getPrevNext(slug: string): { prev?: DocMeta; next?: DocMeta } {
  const i = docs.findIndex((d) => d.meta.slug === slug);
  if (i === -1) return {};
  return { prev: docs[i - 1]?.meta, next: docs[i + 1]?.meta };
}
