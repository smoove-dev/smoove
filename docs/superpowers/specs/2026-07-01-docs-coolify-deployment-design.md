# Docs site deployment: Coolify + GitHub Actions

Date: 2026-07-01

## Goal

Deploy `packages/docs` (the Fumadocs + React Router 7 SSR app) to Coolify at
the apex domain `smoove.dev`, with GitHub Actions gating deploys on CI
passing (lint, typecheck, build) rather than relying on an ungated push
webhook.

## Constraints

- Monorepo: pnpm workspace. `packages/docs` depends on `@smoove/core`,
  `@smoove/google-fonts`, `@smoove/player`, `@smoove/transitions` (deps) and
  `@smoove/vite` (devDep) via `workspace:*`. The Docker build needs the whole
  repo as build context, not just `packages/docs`.
- `packages/docs` is a real SSR app (`ssr: true` in
  `react-router.config.ts`), served in production via
  `react-router-serve ./build/server/index.js` — a long-running Node
  process, not static file output.
- `packages/renderer` and `packages/studio` pull in native deps
  (`skia-canvas`, per-platform ffmpeg binaries — see `onlyBuiltDependencies`
  in `pnpm-workspace.yaml`). Docs does not depend on renderer at all, so the
  build must not install/compile those.
- No tests exist yet (per `AGENTS.md`); "CI" today means lint + typecheck +
  build succeeding.
- A Coolify server is already running; this only adds a new app/resource to
  it.
- No PR preview deployments in this pass — production deploys on merge to
  `main` only.
- Docs currently has no environment variables.

## Design

### 1. Dockerfile — `packages/docs/Dockerfile`, build context = repo root

Multi-stage build:

1. **base** — `node:22-slim`, `corepack enable` (picks up the pinned
   `pnpm@10.33.4` from root `package.json`).
2. **fetch** — copy only `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and every
   workspace `package.json` (manifests only, via a `.dockerignore`-friendly
   layout), then `pnpm fetch`. This layer only invalidates when a dependency
   changes.
3. **build** — copy full repo source, then:
   - `pnpm install --filter "@smoove/docs..." --frozen-lockfile --offline`
   - `pnpm --filter "@smoove/docs..." run build`

   The `@smoove/docs...` filter (package + its workspace deps) means only
   core/google-fonts/player/transitions/vite get installed and built —
   renderer/studio/demo and their native deps are never touched. pnpm
   installs/builds the dependency chain in topological order automatically.
4. **runtime** — `pnpm --filter @smoove/docs deploy --prod /app/deploy` to
   produce a pruned, symlink-free production `node_modules` for just the
   docs package. Because docs has no `package.json` `"files"` field and
   `build/` is gitignored, `pnpm deploy` won't include the build output on
   its own — explicitly `COPY --from=build packages/docs/build
   /app/deploy/build` after the deploy step. `EXPOSE 3000`, `CMD ["pnpm",
   "start"]` (`react-router-serve ./build/server/index.js`, default
   `PORT=3000`).

### 2. Coolify app config

- Resource type: **Dockerfile** build pack.
- Base Directory: `/` (repo root, so the workspace is in the build context).
- Dockerfile Location: `packages/docs/Dockerfile`.
- Port: 3000. Domain: `smoove.dev`.
- **Auto-deploy-on-push: OFF.** Coolify's native GitHub App integration
  would otherwise deploy on every push to `main` regardless of CI status.
  Deploys are triggered only by the GitHub Actions deploy job below.
- No environment variables required today.

### 3. GitHub Actions — `.github/workflows/docs-ci.yml`

Triggers: `pull_request` and `push` to `main`, path-filtered to:
`packages/docs/**`, `packages/core/**`, `packages/google-fonts/**`,
`packages/player/**`, `packages/transitions/**`, `packages/vite/**`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, root `package.json`.

**`ci` job** (runs on both PR and push to main):

1. `pnpm install --filter "@smoove/docs..."`
2. `pnpm biome check .` (repo-wide; cheap, catches lint/format issues)
3. `pnpm --filter "@smoove/docs..." run build`
4. `pnpm --filter @smoove/docs run typecheck` (`react-router typegen && tsc -b`)

**`deploy` job** (only on `push` to `main`, `needs: ci`):

- `curl -X POST "$COOLIFY_BASE_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUID" -H "Authorization: Bearer $COOLIFY_API_TOKEN"`
- Secrets `COOLIFY_BASE_URL`, `COOLIFY_APP_UUID`, `COOLIFY_API_TOKEN` are
  stored as GitHub repo secrets (Settings → Secrets and variables → Actions),
  not committed anywhere.

### Error handling

- `--frozen-lockfile` in the build stage fails the Docker build (and thus
  the Coolify deploy) if `pnpm-lock.yaml` is out of sync — same guarantee CI
  already relies on.
- The `deploy` job only runs `needs: ci`, so a failing lint/typecheck/build
  step on `main` blocks the Coolify deploy call entirely; the previous
  production deployment keeps serving.
- Coolify's own build failure (e.g. Docker build breaks for a reason CI
  didn't catch, such as a runtime-only issue) leaves the previous running
  container in place — Coolify does not tear down a healthy deployment until
  the new one succeeds.

### Testing / verification

- No automated tests exist for docs yet; `pnpm biome check`, workspace-scoped
  `build`, and `typecheck` are the full verification surface today.
- Manual verification after first deploy: hit `https://smoove.dev`, confirm
  SSR HTML renders (view source, not just an empty `<div id="root">`), and
  spot-check a `<Demo>` MDX page to confirm the live `<smoove-player>` embed
  still loads (client bundle + SSR shim both intact).

## Out of scope (this pass)

- PR preview deployments.
- Provisioning the Coolify server itself (already running).
- Environment variables / secrets for the docs app itself (none needed
  today).
