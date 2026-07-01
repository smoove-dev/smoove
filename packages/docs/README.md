# @smoove/docs

The smoove documentation website — a [React Router](https://reactrouter.com)
framework-mode app (SSR) built on [Fumadocs](https://fumadocs.dev), themed
with the smoove brand design (cream-first light, grape-ink dark, coral
accent — see `src/app.css`).

## Authoring a page

Add a `.mdx` file under `content/docs/` (or a subfolder — see the existing
`layout/`, `typography/`, `transitions/`, `player/`, `rendering/`, and
`vite-plugin/` groups). Frontmatter is just:

```mdx
---
title: Introduction
description: What smoove is, the frame-clock mental model, and when to reach for it.
---

Body starts here.
```

Sidebar order and grouping are **not** driven by frontmatter — each folder
has a `meta.json` that lists its pages in order, with a
`"---Group Name---"` string in the `pages` array to start a new sidebar
group:

```json
{
  "title": "Documentation",
  "pages": [
    "---Getting Started---",
    "introduction",
    "installation",
    "core-concepts",
    "---Animating---",
    "interpolation",
    "easing"
  ]
}
```

Nested folders get their own `meta.json` with a local `title` + `pages`
list.

### MDX components

Available in every page via `src/components/mdx.tsx`: `Demo`, `Prop`,
`Badge`, `PropsPlayground`, plus Fumadocs' built-ins (`Callout`,
`Steps`/`Step`, `Tabs`/`Tab`) and `defaultMdxComponents` from
`fumadocs-ui/mdx` for headings, code blocks, tables, and links.

### Live demos

Embed a running composition with `<Demo>`:

```mdx
<Demo name="hero" label="every frame is a pure function of the clock" />
```

`name` resolves to `src/demos/<name>.ts` — `src/components/demo.tsx` loads
it two ways via Vite globs: the served module URL (rendered live in a
`<smoove-player>`, the custom element from `@smoove/player`) and the raw
source (for the "View source" toggle). Optional props: `footer` (panel
below the player) and `initialframe` (frame shown on mount).

## Architecture

- `content/docs/**/*.mdx` — page content, compiled by the `fumadocs-mdx`
  Vite plugin into a generated `collections/server` module.
- `src/lib/source.ts` — `loader({ baseUrl: "/docs", source:
  docs.toFumadocsSource() })` builds the Fumadocs page tree + search index
  from that generated collection.
- `src/routes.ts` — `index → home`, `docs/*`, `api/search`.
- `src/routes/docs.tsx` — server loader resolves the page + serialized page
  tree via `source.getPage`/`serializePageTree`; a Fumadocs
  `createClientLoader()` resolves the compiled MDX body client-side.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @smoove/docs dev` (or root `pnpm dev:docs`) | Dev server at http://localhost:5176 |
| `pnpm --filter @smoove/docs build` | Production SSR build under `build/` |
| `pnpm --filter @smoove/docs start` | Serve the production build |
| `pnpm --filter @smoove/docs typecheck` | `react-router typegen` + `tsc` |
