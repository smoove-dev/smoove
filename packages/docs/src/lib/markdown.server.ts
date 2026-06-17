import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import container from "markdown-it-container";
import kbd from "markdown-it-kbd";
import taskLists from "markdown-it-task-lists";

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/* ------------------------------------------------------------------
   Local markdown-it facade. markdown-it ships no types of its own and
   the @types packages for its plugins pin conflicting versions
   (container wants <14, anchor wants 14). Rather than fight that, we
   model only the surface we use — keeping full type safety on our own
   rules while staying version-proof.
   ------------------------------------------------------------------ */
interface MdToken {
  type: string;
  tag: string;
  level: number;
  nesting: number;
  info: string;
  content: string;
  children: MdToken[] | null;
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
  attrJoin(name: string, value: string): void;
}

interface MdStateCore {
  tokens: MdToken[];
  Token: new (type: string, tag: string, nesting: number) => MdToken;
}

interface MdStateInline {
  pos: number;
  src: string;
  push(type: string, tag: string, nesting: number): MdToken;
}

type RenderRule = (
  tokens: MdToken[],
  idx: number,
  options: unknown,
  env: unknown,
  self: { renderToken(tokens: MdToken[], idx: number, options: unknown): string },
) => string;

interface Md {
  use(plugin: unknown, ...params: unknown[]): Md;
  parse(src: string, env: Record<string, unknown>): MdToken[];
  options: unknown;
  utils: { escapeHtml(s: string): string };
  core: { ruler: { push(name: string, fn: (state: MdStateCore) => void): void } };
  inline: {
    ruler: {
      before(
        before: string,
        name: string,
        fn: (state: MdStateInline, silent: boolean) => boolean,
      ): void;
    };
  };
  renderer: {
    rules: Record<string, RenderRule | undefined>;
    render(tokens: MdToken[], options: unknown, env: Record<string, unknown>): string;
  };
}

const COPY_SVGS = `<svg class="ic-copy" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="9" height="9" rx="2"/><path d="M12 6V4.5A1.5 1.5 0 0010.5 3h-6A1.5 1.5 0 003 4.5v6A1.5 1.5 0 004.5 12H6"/></svg><svg class="ic-check" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5l3.2 3L14 5.5"/></svg>`;

// Per-type callout icons (match the design's inline SVGs).
const CALLOUT_ICONS = {
  note: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6.2"/><path d="M9 8v4M9 5.6v.01"/></svg>`,
  tip: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5a4.2 4.2 0 00-2.5 7.6c.5.4.8 1 .8 1.6V12h3.4v-.3c0-.6.3-1.2.8-1.6A4.2 4.2 0 009 2.5z"/><path d="M7.3 14.5h3.4M7.8 16h2.4"/></svg>`,
  warning: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.8l6.2 11A1 1 0 0114.3 15H3.7a1 1 0 01-.9-1.2z"/><path d="M9 7v3.4M9 12.6v.01"/></svg>`,
  danger: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6.2"/><path d="M9 5.5v4M9 11.9v.01"/></svg>`,
} as const;

const DEMO_HINT = `<div class="demo-slot__hint"><span class="ring"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5l8 4.5-8 4.5z" fill="currentColor" stroke="none"/></svg></span><b>Demo slot</b><span>Mount a &lt;km-player&gt; here — this frame keeps its aspect ratio and theming intact.</span></div>`;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  );
}

const md = new MarkdownIt({
  html: false, // pure Markdown — every design element is produced by the parser
  linkify: true,
  typographer: false,
}) as unknown as Md;

const esc = (s: string) => md.utils.escapeHtml(s);

md.use(anchor, {
  slugify,
  permalink: anchor.permalink.linkInsideHeader({
    symbol: "#",
    class: "heading-anchor",
    placement: "after",
    space: false,
    ariaHidden: true,
  }),
});

// `[[Space]]` -> <kbd>Space</kbd>
md.use(kbd);

// `- [x] done` / `- [ ] todo` -> styled task list (checkboxes disabled)
md.use(taskLists, { label: true });

/* ---------------- callouts: :::note / :::tip / :::warning / :::danger ---------------- */
function calloutContainer(name: keyof typeof CALLOUT_ICONS, mod: string, defaultTitle: string) {
  md.use(container, name, {
    render(tokens: MdToken[], idx: number) {
      const token = tokens[idx];
      if (!token) return "";
      if (token.nesting === 1) {
        const title = token.info.trim().slice(name.length).trim() || defaultTitle;
        return `<div class="callout callout--${mod}"><span class="callout__icon">${CALLOUT_ICONS[name]}</span><div class="callout__body"><div class="callout__title">${esc(title)}</div>`;
      }
      return "</div></div>\n";
    },
  });
}
calloutContainer("note", "note", "Note");
calloutContainer("tip", "tip", "Tip");
calloutContainer("warning", "warning", "Heads up");
calloutContainer("danger", "danger", "Warning");

/* ---------------- demo slot: :::demo [id |] <tag text> ----------------
   `:::demo 1280 × 720` → a placeholder slot (just a label).
   `:::demo orbit | 1280 × 720` → the leading `id |` names a composition the
   client mounts a live <km-player> into (see `demos/registry.ts`). */
md.use(container, "demo", {
  render(tokens: MdToken[], idx: number) {
    const token = tokens[idx];
    if (!token) return "";
    if (token.nesting === 1) {
      const raw = token.info.trim().slice("demo".length).trim();
      const sep = raw.indexOf("|");
      const id = sep >= 0 ? raw.slice(0, sep).trim() : "";
      const tag = sep >= 0 ? raw.slice(sep + 1).trim() : raw;
      const tagHtml = tag ? `<span class="tag">${esc(tag)}</span>` : "";
      const demoAttr = id ? ` data-km-demo="${esc(id)}"` : "";
      return `<div class="demo-slot"><div class="demo-slot__bar"><span class="glow" aria-hidden="true"></span><span class="label">Live demo</span>${tagHtml}</div><div class="demo-slot__stage"${demoAttr}>${DEMO_HINT}`;
    }
    return "</div></div>\n";
  },
});

/* ---------------- API prop: :::prop name | (signature) | badge ---------------- */
md.use(container, "prop", {
  render(tokens: MdToken[], idx: number) {
    const token = tokens[idx];
    if (!token) return "";
    if (token.nesting === 1) {
      const parts = token.info.trim().slice("prop".length).split("|");
      const name = esc((parts[0] ?? "").trim());
      const type = parts[1] ? `<span class="prop__type">${esc(parts[1].trim())}</span>` : "";
      const badge = parts[2]
        ? `<span class="badge badge--good">${esc(parts[2].trim())}</span>`
        : "";
      return `<div class="prop"><div class="prop__head"><span class="prop__name">${name}</span>${type}${badge}</div>`;
    }
    return "</div>\n";
  },
});

/* ---------------- steps: :::steps wrapping an ordered list ---------------- */
md.use(container, "steps", {
  render(tokens: MdToken[], idx: number) {
    return tokens[idx]?.nesting === 1 ? `<div class="steps">\n` : "</div>\n";
  },
});

function htmlToken(state: MdStateCore, content: string): MdToken {
  const t = new state.Token("html_block", "", 0);
  t.content = content;
  return t;
}

// Transform the ordered list inside a `:::steps` container into the design's
// `.steps__item` / `.steps__title` structure. The first paragraph of each item
// becomes the title; the rest is the step body.
function buildSteps(state: MdStateCore, inner: MdToken[]): MdToken[] {
  const out: MdToken[] = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i]?.type === "list_item_open") {
      const level = inner[i]?.level ?? 0;
      let end = i + 1;
      while (
        end < inner.length &&
        !(inner[end]?.type === "list_item_close" && inner[end]?.level === level)
      ) {
        end++;
      }
      const body = inner.slice(i + 1, end);
      out.push(htmlToken(state, '<div class="steps__item">'));
      if (body[0]?.type === "paragraph_open") {
        let pc = 1;
        while (pc < body.length && body[pc]?.type !== "paragraph_close") pc++;
        out.push(htmlToken(state, '<div class="steps__title">'));
        for (let z = 1; z < pc; z++) {
          const tk = body[z];
          if (tk) out.push(tk);
        }
        out.push(htmlToken(state, "</div>"));
        for (let z = pc + 1; z < body.length; z++) {
          const tk = body[z];
          if (tk) out.push(tk);
        }
      } else {
        out.push(...body);
      }
      out.push(htmlToken(state, "</div>"));
      i = end + 1;
    } else {
      i++;
    }
  }
  return out;
}

md.core.ruler.push("km_steps", (state) => {
  const t = state.tokens;
  let i = 0;
  while (i < t.length) {
    if (t[i]?.type === "container_steps_open") {
      let j = i + 1;
      while (
        j < t.length &&
        t[j]?.type !== "ordered_list_open" &&
        t[j]?.type !== "bullet_list_open" &&
        t[j]?.type !== "container_steps_close"
      ) {
        j++;
      }
      const open = t[j];
      if (open && (open.type === "ordered_list_open" || open.type === "bullet_list_open")) {
        const closeType =
          open.type === "ordered_list_open" ? "ordered_list_close" : "bullet_list_close";
        let k = j + 1;
        while (k < t.length && !(t[k]?.type === closeType && t[k]?.level === open.level)) k++;
        const replacement = buildSteps(state, t.slice(j + 1, k));
        t.splice(j, k - j + 1, ...replacement);
        i = j + replacement.length;
        continue;
      }
    }
    i++;
  }
});

/* ---------------- inline badges: {{text}} / {{accent:text}} ---------------- */
const BADGE_VARIANTS = new Set(["accent", "good", "warn"]);
md.inline.ruler.before("emphasis", "km_badge", (state, silent) => {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x7b || state.src.charCodeAt(start + 1) !== 0x7b)
    return false;
  const end = state.src.indexOf("}}", start + 2);
  if (end < 0) return false;
  if (!silent) {
    const raw = state.src.slice(start + 2, end);
    const m = raw.match(/^(\w+):([\s\S]+)$/);
    let cls = "badge";
    let text = raw;
    if (m?.[1] && BADGE_VARIANTS.has(m[1])) {
      cls = `badge badge--${m[1]}`;
      text = m[2] ?? "";
    }
    const token = state.push("html_inline", "", 0);
    token.content = `<span class="${cls}">${esc(text.trim())}</span>`;
  }
  state.pos = end + 2;
  return true;
});

/* ---------------- first paragraph -> .lead ---------------- */
md.core.ruler.push("km_lead", (state) => {
  const first = state.tokens.find((t) => t.level === 0 && t.nesting === 1);
  if (first?.type === "paragraph_open") first.attrJoin("class", "lead");
});

/* ---------------- blockquote attribution line (`> — Name`) -> <cite> ---------------- */
md.core.ruler.push("km_cite", (state) => {
  const t = state.tokens;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    if (!tok) continue;
    if (tok.type === "blockquote_open") depth++;
    else if (tok.type === "blockquote_close") depth--;
    else if (depth > 0 && tok.type === "paragraph_open") {
      const inline = t[i + 1];
      const close = t[i + 2];
      const firstChild = inline?.children?.[0];
      if (
        inline?.type === "inline" &&
        close?.type === "paragraph_close" &&
        firstChild?.type === "text"
      ) {
        const m = firstChild.content.match(/^(?:—|--)\s?([\s\S]*)$/);
        if (m) {
          tok.tag = "cite";
          close.tag = "cite";
          firstChild.content = m[1] ?? "";
        }
      }
    }
  }
});

/* ---------------- image-only paragraph -> <figure> + <figcaption> (from title) ---------------- */
md.core.ruler.push("km_figure", (state) => {
  const t = state.tokens;
  for (let i = 0; i < t.length; i++) {
    if (t[i]?.type !== "paragraph_open") continue;
    const inline = t[i + 1];
    const close = t[i + 2];
    const open = t[i];
    if (!open || inline?.type !== "inline" || close?.type !== "paragraph_close") continue;
    const children = inline.children ?? [];
    const meaningful = children.filter((c) => !(c.type === "text" && c.content.trim() === ""));
    const img = meaningful[0];
    if (meaningful.length !== 1 || img?.type !== "image") continue;
    open.tag = "figure";
    close.tag = "figure";
    const title = img.attrGet("title");
    if (title) {
      img.attrSet("title", "");
      const cap = new state.Token("html_inline", "", 0);
      cap.content = `<figcaption>${esc(title)}</figcaption>`;
      children.push(cap);
    }
  }
});

/* ---------------- tables auto-wrapped in .table-wrap ---------------- */
md.renderer.rules.table_open = () => `<div class="table-wrap"><table>`;
md.renderer.rules.table_close = () => "</table></div>";

/* ---------------- external links open in a new tab ---------------- */
const defaultLinkOpen: RenderRule =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token?.attrGet("href") ?? "";
  if (token && /^https?:\/\//.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/* ---------------- code fences -> design code-block chrome + highlight.js ---------------- */
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  if (!token) return "";
  const lang = (token.info.trim().split(/\s+/g)[0] || "text").toLowerCase();
  const code = token.content;
  let highlighted: string;
  if (lang && lang !== "text" && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } catch {
      highlighted = esc(code);
    }
  } else {
    highlighted = esc(code);
  }
  const label = esc(lang);
  return `<div class="code-block"><div class="code-block__bar"><span class="code-block__dots"><i></i><i></i><i></i></span><span class="code-block__lang">${label}</span><button class="code-block__copy" aria-label="Copy code">${COPY_SVGS}<span class="copy-label">Copy</span></button></div><pre class="scroll"><code class="language-${label} hljs">${highlighted}</code></pre></div>`;
};

function collectHeadings(tokens: MdToken[]): Heading[] {
  const out: Heading[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || t.type !== "heading_open") continue;
    if (t.tag !== "h2" && t.tag !== "h3") continue;
    const id = t.attrGet("id") ?? "";
    const inline = tokens[i + 1];
    const text = inline && inline.type === "inline" ? inline.content : "";
    out.push({ id, text, level: t.tag === "h2" ? 2 : 3 });
  }
  return out;
}

export function renderMarkdown(src: string): { html: string; headings: Heading[] } {
  const env: Record<string, unknown> = {};
  const tokens = md.parse(src, env);
  const headings = collectHeadings(tokens);
  const html = md.renderer.render(tokens, md.options, env);
  return { html, headings };
}
