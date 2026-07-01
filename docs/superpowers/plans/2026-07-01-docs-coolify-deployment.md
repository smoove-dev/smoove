# Docs Site Coolify + GitHub Actions Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get `packages/docs` (the Fumadocs + React Router 7 SSR app) deploying
to Coolify at `smoove.dev`, with GitHub Actions gating each deploy on
lint/typecheck/build passing.

**Architecture:** A multi-stage `Dockerfile` at `packages/docs/Dockerfile`
(build context = repo root) installs and builds only `@smoove/docs` and its
workspace dependency chain via pnpm's `--filter "@smoove/docs..."`, then
packs a pruned production `node_modules` with `pnpm deploy --prod`. Coolify
builds this Dockerfile directly (auto-deploy-on-push disabled). A GitHub
Actions workflow runs CI on every PR and push to `main`, and only on a green
`push` to `main` calls Coolify's REST API to trigger the actual deploy.

**Tech Stack:** Docker, pnpm workspaces (pnpm 10.33.4, pinned via
`packageManager` + corepack), GitHub Actions, Coolify v4 REST API.

**Reference spec:** `docs/superpowers/specs/2026-07-01-docs-coolify-deployment-design.md`

---

### Task 1: `.dockerignore` at repo root

**Files:**
- Create: `.dockerignore`

Keeps the Docker build context small and avoids shipping host-machine
artifacts (existing `node_modules`, build outputs, VCS metadata) into the
image — these all get regenerated fresh inside the container.

- [ ] **Step 1: Write `.dockerignore`**

```
node_modules
**/node_modules
.git
**/dist
**/build
**/.react-router
**/.source
**/*.tsbuildinfo
.DS_Store
demo/build
packages/renderer
packages/studio
```

`packages/renderer` and `packages/studio` are excluded from the build context
entirely — docs doesn't depend on either, and renderer pulls in native
`skia-canvas`/ffmpeg binaries we never want touched by this build. (The
`pnpm install --filter "@smoove/docs..."` in Task 2 would skip them anyway;
excluding them from the context too just keeps the upload/context-hashing
fast.)

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "Add .dockerignore for docs Docker build"
```

---

### Task 2: `packages/docs/Dockerfile`

**Files:**
- Create: `packages/docs/Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app

# ---- fetch: populate the pnpm store from lockfile + manifests only ----
FROM base AS fetch
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/google-fonts/package.json packages/google-fonts/package.json
COPY packages/player/package.json packages/player/package.json
COPY packages/transitions/package.json packages/transitions/package.json
COPY packages/vite/package.json packages/vite/package.json
COPY packages/docs/package.json packages/docs/package.json
RUN pnpm fetch

# ---- build: full source, install + build only docs' dependency chain ----
FROM fetch AS build
COPY . .
RUN pnpm install --filter "@smoove/docs..." --frozen-lockfile --offline
RUN pnpm --filter "@smoove/docs..." run build
RUN pnpm --filter @smoove/docs deploy --prod /app/deploy

# ---- runtime: pruned prod node_modules + the SSR build output ----
FROM base AS runtime
COPY --from=build /app/deploy /app
COPY --from=build /app/packages/docs/build /app/build
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
```

- [ ] **Step 2: Commit**

```bash
git add packages/docs/Dockerfile
git commit -m "Add Dockerfile for docs site"
```

---

### Task 3: Verify the image builds and serves locally

**Files:** none (verification only)

- [ ] **Step 1: Build the image from repo root**

Run:
```bash
docker build -f packages/docs/Dockerfile -t smoove-docs:local .
```
Expected: build completes successfully, ending with an image tagged
`smoove-docs:local`. If `pnpm install --filter "@smoove/docs..."
--frozen-lockfile` fails, the lockfile is out of sync with a
`packages/docs/package.json` change — resolve by running `pnpm install` at
the repo root and committing the updated `pnpm-lock.yaml` before retrying.

- [ ] **Step 2: Run the container**

Run:
```bash
docker run --rm -d -p 3000:3000 --name smoove-docs-test smoove-docs:local
sleep 2
curl -s -o /tmp/docs-smoke.html -w "%{http_code}\n" http://localhost:3000/
```
Expected: HTTP status `200`.

- [ ] **Step 3: Confirm real SSR HTML (not an empty shell)**

Run:
```bash
grep -c "<html" /tmp/docs-smoke.html
grep -o '<title>[^<]*</title>' /tmp/docs-smoke.html
```
Expected: `1` for the html-tag count, and a non-empty `<title>` — confirms
the page was actually server-rendered, not just an empty `<div id="root">`
waiting for client JS.

- [ ] **Step 4: Tear down the test container**

Run:
```bash
docker stop smoove-docs-test
```

---

### Task 4: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/docs-ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: docs-ci

on:
  pull_request:
    paths:
      - "packages/docs/**"
      - "packages/core/**"
      - "packages/google-fonts/**"
      - "packages/player/**"
      - "packages/transitions/**"
      - "packages/vite/**"
      - "pnpm-lock.yaml"
      - "pnpm-workspace.yaml"
      - "package.json"
      - ".github/workflows/docs-ci.yml"
  push:
    branches: [main]
    paths:
      - "packages/docs/**"
      - "packages/core/**"
      - "packages/google-fonts/**"
      - "packages/player/**"
      - "packages/transitions/**"
      - "packages/vite/**"
      - "pnpm-lock.yaml"
      - "pnpm-workspace.yaml"
      - "package.json"
      - ".github/workflows/docs-ci.yml"

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --filter "@smoove/docs..." --frozen-lockfile
      - run: pnpm biome check .
      - run: pnpm --filter "@smoove/docs..." run build
      - run: pnpm --filter @smoove/docs run typecheck

  deploy:
    needs: ci
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Coolify deploy
        run: |
          curl -fsS -X POST \
            "${COOLIFY_BASE_URL}/api/v1/deploy?uuid=${COOLIFY_APP_UUID}" \
            -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
        env:
          COOLIFY_BASE_URL: ${{ secrets.COOLIFY_BASE_URL }}
          COOLIFY_APP_UUID: ${{ secrets.COOLIFY_APP_UUID }}
          COOLIFY_API_TOKEN: ${{ secrets.COOLIFY_API_TOKEN }}
```

`pnpm/action-setup@v4` reads the `packageManager` field from the root
`package.json` automatically, so it installs pnpm 10.33.4 without a version
pin in the workflow itself.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/docs-ci.yml
git commit -m "Add docs-ci workflow: CI gate + Coolify deploy trigger"
```

---

### Task 5: GitHub repo secrets

**Files:** none (GitHub UI configuration)

- [ ] **Step 1: Add the three secrets**

In the GitHub repo → Settings → Secrets and variables → Actions → New
repository secret, add:
- `COOLIFY_BASE_URL` — e.g. `https://coolify.your-domain.com` (no trailing
  slash)
- `COOLIFY_APP_UUID` — the UUID of the app resource created in Task 6
- `COOLIFY_API_TOKEN` — a Coolify API token (Coolify UI → Keys & Tokens →
  create a token scoped to "deploy" if Coolify's version supports scoped
  tokens, otherwise a root token)

These can't be verified until Task 6 creates the Coolify app and its UUID
exists — do Task 6 first if doing this in strict order, or come back to fill
in `COOLIFY_APP_UUID` after.

---

### Task 6: Coolify app setup

**Files:** none (Coolify UI configuration)

- [ ] **Step 1: Create the resource**

In Coolify: New Resource → Docker-based → point at this repo/branch `main`.
Set:
- Build Pack: **Dockerfile**
- Base Directory: `/`
- Dockerfile Location: `packages/docs/Dockerfile`
- Ports Exposes: `3000`
- Domain: `smoove.dev`

- [ ] **Step 2: Disable auto-deploy-on-push**

In the app's General/Source settings, turn off "Automatic deployment" (the
exact label depends on Coolify version — look for the push-webhook /
auto-deploy toggle). This is required: GitHub Actions is the only thing that
should trigger a deploy, gated on CI.

- [ ] **Step 3: Copy the app UUID into GitHub secrets**

Copy the app's UUID (visible in the app's URL or its Webhooks/API section in
the Coolify UI) into the `COOLIFY_APP_UUID` GitHub secret from Task 5.

- [ ] **Step 4: First manual deploy**

Trigger one deploy manually from the Coolify UI (Deploy button) to confirm
the Dockerfile builds successfully on the Coolify server itself, independent
of the GitHub Actions trigger. Watch the build log for the `pnpm install
--filter` and `pnpm deploy --prod` steps completing.

---

### Task 7: End-to-end verification

**Files:** none (manual verification)

- [ ] **Step 1: Merge to main and watch the pipeline**

Merge a small no-op change (or this plan's own commits) to `main`. Confirm
in the GitHub Actions tab: `ci` job runs and passes, `deploy` job runs after
and gets a `2xx` from the `curl` step.

- [ ] **Step 2: Confirm the live site**

Run:
```bash
curl -s -o /tmp/docs-live.html -w "%{http_code}\n" https://smoove.dev/
grep -o '<title>[^<]*</title>' /tmp/docs-live.html
```
Expected: `200` and a real title — confirms SSR is working in production,
not just in the local Task 3 check.

- [ ] **Step 3: Spot-check a `<Demo>` MDX page**

Open a docs page that embeds a `<Demo name="..." />` live `<smoove-player>`
component in a browser. Confirm the player actually renders and animates
(not a blank canvas) — this exercises both the SSR shim
(`node-module-shim.ts`) and the client bundle together, the one part of the
pipeline Task 3's plain `curl` check can't catch.
