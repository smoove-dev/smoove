# @konva-motion/docs

The konva-motion documentation website — a [React Router](https://reactrouter.com)
framework-mode app (SSR) that renders Markdown pages with the KmStudio design system.

## Authoring a page

Add a `.md` file under `src/content/`. The filename's numeric prefix sets the default
ordering (`02-installation.md` → slug `installation`). Each file starts with a
frontmatter header:

```markdown
---
title: Installation          # page title (sidebar, <h1>, <title>)
group: Getting Started       # sidebar section it belongs to
order: 2                     # sort order within the group (defaults to filename prefix)
eyebrow: Getting Started     # optional kicker rendered above the <h1>
description: One-line summary # optional <meta name="description">
icon: cube                   # optional sidebar icon key (see components/icons.tsx)
slug: installation           # optional explicit slug (defaults to the filename)
---

Body starts here. Do **not** repeat the `<h1>` — it comes from `title`. Open
sections with `##` headings; they feed the "On this page" table of contents.
```

Sidebar groups render in this order, then any others alphabetically:
`Getting Started → Core Concepts → Components → API Reference` (see
`GROUP_ORDER` in `src/lib/content.server.ts`).

### Rich content — pure Markdown, no HTML

Every design element is produced by the parser, so pages are **100% Markdown** (raw
HTML is disabled). See `src/content/03-components.md` for a live example of each.

| Element | Markdown |
| --- | --- |
| **Lead** | The first paragraph of the body is styled as the lead automatically. |
| **Callouts** | `:::note Title` … `:::` — also `tip`, `warning`, `danger`. Title is optional. |
| **Steps** | `:::steps` wrapping an ordered list; each item's first paragraph (bold) is the step title. |
| **API prop** | `:::prop name \| (signature) \| badge` … `:::` (type and badge optional). |
| **Demo slot** | `:::demo 1280 × 720 canvas` … `:::` (frames a `<km-player>` or placeholder). |
| **Badges** | `{{stable}}`, or with a variant `{{accent:stable}}` / `{{good:v1.0}}` / `{{warn:beta}}`. |
| **Keyboard keys** | `[[Space]]`, `[[⌘]][[K]]` → `<kbd>`. |
| **Task lists** | `- [x] done` / `- [ ] todo`. |
| **Blockquote cite** | A `> — Name` line becomes the attribution `<cite>`. |
| **Tables** | Standard Markdown tables (auto-wrapped so they scroll on small screens). |
| **Figures** | An image alone in a paragraph becomes a `<figure>`; its title becomes the caption: `![alt](src "caption")`. |
| **Code** | Fenced code blocks get the themed chrome + server-side highlight.js. |

External links (`https://…`) automatically open in a new tab.

### Live demos

Embed a running composition with the `<km-player>` element from
`@konva-motion/player` (registered in the browser via `entry.client.tsx`):

```html
<km-player src="/demos/pulse.js" controls></km-player>
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @konva-motion/docs dev` | Dev server at http://localhost:5176 |
| `pnpm --filter @konva-motion/docs build` | Production SSR build under `build/` |
| `pnpm --filter @konva-motion/docs start` | Serve the production build |
| `pnpm --filter @konva-motion/docs typecheck` | `react-router typegen` + `tsc` |
