# kitchen-sink package — design

**Date:** 2026-07-09
**Branch:** `feature/shemi/kitchen-sink`

## Goal

Give the repo a first-class, in-tree app for exercising the `@smoove/*`
packages while developing them. Port the old root-level `demo` app (removed
from git and gitignored in commit `7364235`, source recoverable from
`7364235^`) into `packages/kitchen-sink`.

## Decisions

- **Resolution:** `workspace:*` → built `dist/` (same as the old demo). No
  source aliasing. Working on a package means running `pnpm build` or a
  per-package `tsc -b --watch`. Matches how real published consumers resolve.
- **Location:** `packages/kitchen-sink` — inside the `packages/*` workspace
  glob automatically.
- **Name:** `@smoove/kitchen-sink`, `private: true`. Added to changeset
  `ignore` so it never publishes and stays out of the fixed/lockstep group.
- **Tracked** (unlike the old `demo/`, which was gitignored).

## What it is

A faithful port of the demo: React Router 7 framework-mode SSR app wrapping
`@smoove/studio`'s `<Studio>` around a ~30-composition registry
(`src/registry.ts`), with real routes (`/`, `/c/:id`, `/queue`) and a
server-side render queue (`src/server/render-queue.server.ts` +
`/api/render*` SSE jobs) backed by `@smoove/renderer`.

## Changes on top of a straight copy

1. Recover every tracked `demo/**` file from `7364235^` **except** the
   generated `build/` and `.react-router/` trees. Includes all binary media
   under `src/files/`.
2. `package.json`: name `demo` → `@smoove/kitchen-sink`. Deps unchanged.
3. `tsconfig.json` (only depth-sensitive file): `extends
   ../tsconfig.base.json` → `../../tsconfig.base.json`; references
   `../packages/{core,player,studio}` → `../{core,player,studio}`.
4. `vite.config.ts`: unchanged (uses `import.meta.url`). Port stays `5174`.
5. Root `package.json`: `dev` script filter `demo` → `@smoove/kitchen-sink`.
6. `.changeset/config.json`: add `@smoove/kitchen-sink` to `ignore`.
7. Root `tsconfig.json`: replace dead `./demo` ref with
   `./packages/kitchen-sink`; drop dead `./demo2` ref. (Dead
   `./packages/timeline` and `./packages/layout` refs left as pre-existing.)
8. `pnpm-workspace.yaml`: drop the stale `# - "demo"` comment.
9. `AGENTS.md`: swap the `demo` layout entry for `packages/kitchen-sink`;
   update the `pnpm dev` description.

## Out of scope

- No source-aliasing / live-HMR wiring.
- No adding `@smoove/effects` (the demo never used it).
- No cleanup of the other pre-existing stale root tsconfig refs
  (`timeline`, `layout`).
