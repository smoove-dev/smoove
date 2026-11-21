# @smoove/docs

The smoove documentation website. A [React Router](https://reactrouter.com)
framework-mode app built on [Fumadocs](https://fumadocs.dev), pre-rendered to
static files at build time, themed
with the smoove brand design (cream-first light, grape-ink dark, coral
accent; see `src/app.css`).

## Authoring a page

Add a `.mdx` file under `content/docs/` (or a subfolder; see the existing
`layout/`, `typography/`, `transitions/`, `player/`, `rendering/`, and
`vite-plugin/` groups). Frontmatter is just:

```mdx
---
title: Introduction
description: What smoove is, the frame-clock mental model, and when to reach for it.
---

Body starts here.
```

Sidebar order and grouping are **not** driven by frontmatter. Each folder
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

Nested folders get their own `meta.json` with a local `title` and `pages`
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

`name` resolves to `src/demos/<name>.ts`. `src/components/demo.tsx` loads
it two ways via Vite globs: the served module URL (rendered live in a
`<smoove-player>`, the custom element from `@smoove/player`) and the raw
source (for the "View source" toggle). Optional props: `footer` (panel
below the player) and `initialframe` (frame shown on mount).

## Architecture

- `content/docs/**/*.mdx`: page content, compiled by the `fumadocs-mdx`
  Vite plugin into a generated `collections/server` module.
- `src/lib/source.ts`: `loader({ baseUrl: "/docs", source:
  docs.toFumadocsSource() })` builds the Fumadocs page tree and search
  index from that generated collection.
- `src/routes.ts`: `index` maps to `home`, plus `docs/*`, `api/search`
  and the agent text routes (`llms.txt`, `llms-full.txt`, and one Markdown
  file per page at `/llms.mdx/docs/<slug>.md`).
- `src/routes/docs.tsx`: the loader resolves the page and serialized page
  tree via `source.getPage`/`serializePageTree`; a Fumadocs
  `createClientLoader()` resolves the compiled MDX body.
- `react-router.config.ts`: sets `ssr: false` and lists every URL to
  pre-render. Every docs page, the search index and the agent text files
  become plain files in `build/client`. No server runs in production.
- `src/routes/search.ts` pre-renders the whole search index to
  `/api/search`, and `src/components/search-dialog.tsx` downloads it and
  searches in the browser.

## Deploying

The site is static files on Cloudflare: Workers static assets with no
Worker script (`wrangler.jsonc`), plus an R2 bucket for the demo media.
`.github/workflows/docs-ci.yml` deploys on every push to `main`:

1. Build with `MEDIA_BASE_URL` set to the bucket's public URL, so the demo
   modules load their video, audio and images from there.
2. `node scripts/upload-media.mjs` uploads those files to the bucket and
   removes them from `build/client`. It also fails the deploy if any file
   left is over Cloudflare's 25 MiB limit.
3. `npx wrangler deploy` uploads the rest.

Media goes to R2 because Cloudflare's static assets don't answer byte-range
requests, which browsers use to stream video. The deploy needs two GitHub
secrets in the `Prod` environment, `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, and two variables, `MEDIA_BASE_URL` and
`R2_BUCKET`. The bucket's CORS rule is in `r2-cors.json`:

```bash
npx wrangler r2 bucket cors set smoove-media --file packages/docs/r2-cors.json
```

To try the production build locally, build without `MEDIA_BASE_URL` (the
media then stays in the build) and serve it with Wrangler:

```bash
pnpm --filter @smoove/docs build && cd packages/docs && npx wrangler dev
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @smoove/docs dev` (or root `pnpm dev:docs`) | Dev server at http://localhost:5176 |
| `pnpm --filter @smoove/docs build` | Static production build under `build/client` |
| `pnpm --filter @smoove/docs typecheck` | `react-router typegen` + `tsc` |
