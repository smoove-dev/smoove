# Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual laptop releases with Changesets-driven, PR-based releases published to npm from GitHub Actions via trusted publishing (OIDC), plus PR CI and contributor/maintainer guides.

**Architecture:** `@changesets/cli` in fixed (lockstep) mode versions the 8 publishable packages together; `changesets/action@v1` maintains a "Version Packages" PR on every push to `main` and, when that PR merges, runs `changeset publish` (which shells out to `pnpm publish` per package, rewriting `workspace:*` and authenticating via OIDC — no npm token). A small script keeps `templates/*` version pins in sync. Three workflows: `ci.yml` (build / biome / changeset presence), `smoke-templates.yml` (path-filtered), `release.yml`.

**Tech Stack:** pnpm 10 workspaces, @changesets/cli + @changesets/changelog-github, changesets/action@v1, GitHub Actions, npm trusted publishing (OIDC).

**Spec:** `docs/superpowers/specs/2026-07-06-release-workflow-design.md`

> **REPO RULE — NO COMMITS.** AGENTS.md forbids `git commit`/`git push` unless Rotem explicitly asks. Every "commit" checkpoint in this plan is instead a **review checkpoint**: run `git status --porcelain` and report. Leave all changes in the working tree.

**Verified facts the plan relies on (researched 2026-07-07):**
- `changeset publish` detects the workspace tool via manypkg and uses `pnpm publish` in pnpm repos (`getPublishTool` in @changesets/cli `npm-utils.ts`), so `workspace:*` ranges are rewritten at publish and OIDC is handled by pnpm. pnpm 10 supports npm trusted publishing (a pnpm 11 regression exists — repo pins pnpm 10.33.4, fine). Do not let a stray `yarn.lock`/`package-lock.json` into the repo root; it would flip the detected publish tool.
- `changesets/action` stable is **v1** (v1.9.0; v2 is still `-next`). v1 input names are camelCase: `version`, `publish`, `commit`, `title`, `createGithubReleases`; outputs `published`, `publishedPackages`.
- npm trusted publishing needs Node ≥ 22.14 and the trusted-publisher workflow field is the **filename only** (`release.yml`, not the path).
- The action writes `~/.npmrc` with `_authToken=${NPM_TOKEN}` when no `~/.npmrc` exists — with OIDC there is no NPM_TOKEN, so we pre-create a benign `~/.npmrc` to keep it from injecting a bogus token.
- **Spec correction:** the smoke test cannot run on the release PR — the release PR re-pins templates to a version that is not on npm yet, so `npm install` inside the scaffolded templates fails by construction. Instead it is skipped on `changeset-release/main` and runs post-release via `workflow_dispatch`.

## File structure

- Create: `.changeset/config.json` (+ generated `.changeset/README.md`)
- Create: `scripts/sync-template-versions.mjs` — templates half of the old bump script
- Delete: `scripts/bump.mjs`
- Modify: `package.json` — swap `bump`/`release` scripts for `release:version`/`release:publish`, add changesets dev deps
- Create: `.github/workflows/ci.yml` — build, check, changeset jobs
- Create: `.github/workflows/smoke-templates.yml` — path-filtered template smoke
- Create: `.github/workflows/release.yml` — version PR + OIDC publish
- Create: `CONTRIBUTING.md`
- Create: `RELEASING.md`

---

### Task 1: Install and configure Changesets

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `.changeset/config.json`, `.changeset/README.md` (generated)

- [ ] **Step 1: Install dev deps at the workspace root**

Run:
```bash
pnpm add -Dw @changesets/cli @changesets/changelog-github
```
Expected: both added to root `package.json` devDependencies (@changesets/cli ^2.31.0, @changesets/changelog-github ^0.7.0 or later).

- [ ] **Step 2: Initialize changesets**

Run:
```bash
pnpm exec changeset init
```
Expected: creates `.changeset/README.md` and `.changeset/config.json`.

- [ ] **Step 3: Replace `.changeset/config.json`**

Keep the `$schema` line that `init` generated (it pins the right config version); replace the rest so the file reads:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "smoove-dev/smoove" }],
  "commit": false,
  "fixed": [
    [
      "@smoove/core",
      "@smoove/player",
      "@smoove/transitions",
      "@smoove/renderer",
      "@smoove/studio",
      "@smoove/google-fonts",
      "@smoove/vite",
      "create-smoove"
    ]
  ],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@smoove/docs", "demo"]
}
```

Notes locked in here:
- The fixed group is an **explicit list**, not the `@smoove/*` glob from the spec draft — the glob would pull in the private `@smoove/docs`, which conflicts with `ignore`. `@smoove/docs` and `demo` are ignored so docs-site/demo PRs never require a changeset and never get versioned. (Deviation from `bump.mjs`, which bumped docs too; harmless — docs is never published.)
- `workspace:*` internal ranges are untouched by `updateInternalDependencies`; pnpm rewrites them at publish.

- [ ] **Step 4: Verify changesets sees the workspace**

Run:
```bash
pnpm exec changeset status
```
Expected: exits 0 with "No changesets present" (or similar) — no config errors about fixed/ignore.

- [ ] **Step 5: Review checkpoint**

Run `git status --porcelain` — expect modified `package.json`, `pnpm-lock.yaml`, new `.changeset/`. Do NOT commit.

---

### Task 2: Template sync script + package.json scripts

**Files:**
- Create: `scripts/sync-template-versions.mjs`
- Delete: `scripts/bump.mjs`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `scripts/sync-template-versions.mjs`**

This is the templates half of the old `scripts/bump.mjs`, reading the current version instead of computing one:

```js
#!/usr/bin/env node
// Re-pin every templates/* package.json @smoove/* dep to the current
// release line (^<version of @smoove/core>).
//
// Templates aren't workspace packages — they pin literal ranges so a raw
// GitHub fetch installs from npm. `changeset version` doesn't know about
// them, so the root `release:version` script runs this right after it.
// (templates/shared is source material, not a template — no package.json.)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const version = JSON.parse(
  readFileSync(join(root, "packages", "core", "package.json"), "utf8"),
).version;

const templatesDir = join(root, "templates");
for (const dir of readdirSync(templatesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  const path = join(templatesDir, dir, "package.json");
  if (!existsSync(path)) continue;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  let touched = false;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith("@smoove/")) {
        pkg[field][name] = `^${version}`;
        touched = true;
      }
    }
  }
  if (touched) {
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`templates/${dir}  @smoove/* -> ^${version}`);
  }
}
```

- [ ] **Step 2: Run it to verify it's a no-op at the current version**

Run:
```bash
node scripts/sync-template-versions.mjs && git diff --stat templates
```
Expected: prints `templates/<name>  @smoove/* -> ^0.1.6` lines; `git diff --stat` shows **no changes** (pins are already `^0.1.6`, rewrite is byte-identical).

- [ ] **Step 3: Delete `scripts/bump.mjs`**

Run:
```bash
git rm scripts/bump.mjs
```

- [ ] **Step 4: Update root `package.json` scripts**

Remove the `bump` and `release` entries. Add `release:version` and `release:publish`. The final `scripts` block:

```json
"scripts": {
  "build": "pnpm -r --filter \"./packages/*\" run build",
  "dev": "pnpm --filter demo run dev",
  "dev:docs": "pnpm --filter docs run dev",
  "check": "biome check .",
  "format": "biome format --write .",
  "sync:templates": "node scripts/sync-composition.mjs",
  "release:version": "changeset version && node scripts/sync-template-versions.mjs && pnpm install --lockfile-only",
  "release:publish": "pnpm build && changeset publish"
}
```

Why these names: the script must not be called `publish` (npm lifecycle double-runs it) or `version` (npm lifecycle collision with `npm version`). `pnpm install --lockfile-only` keeps the lockfile consistent after version bumps (a no-op today since internal deps are `workspace:*`, but prevents drift if a semver-ranged internal dep ever appears).

- [ ] **Step 5: Verify scripts resolve**

Run:
```bash
pnpm run 2>&1 | grep -A1 "release:"
```
Expected: both `release:version` and `release:publish` listed. (Don't run them.)

- [ ] **Step 6: Review checkpoint**

`git status --porcelain` — expect deleted `scripts/bump.mjs`, modified `package.json`, new `scripts/sync-template-versions.mjs`.

---

### Task 3: PR CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  pull_request:
    # labeled/unlabeled so the changeset job re-evaluates when the
    # no-changeset label is toggled
    types: [opened, synchronize, reopened, labeled, unlabeled]
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      # headless-gl (renderer's `gl` dep) compiles from source when no
      # prebuilt binary matches the runner's Node ABI
      - name: Install headless-gl build deps
        run: sudo apt-get update && sudo apt-get install -y libxi-dev libglu1-mesa-dev libglew-dev pkg-config
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      # --ignore-scripts: biome needs no native builds
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - run: pnpm check

  changeset:
    # Skipped (counts as passing for required checks) on: the release PR,
    # PRs labeled no-changeset, and pushes to main.
    if: >-
      github.event_name == 'pull_request' &&
      github.head_ref != 'changeset-release/main' &&
      !contains(github.event.pull_request.labels.*.name, 'no-changeset')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile --ignore-scripts
      # Fails when a package in the release set changed with no changeset.
      # Ignored packages (@smoove/docs, demo) never trigger it.
      - run: pnpm exec changeset status --since=origin/main
```

- [ ] **Step 2: Validate the YAML parses**

Run:
```bash
ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml"); puts "ok"'
```
Expected: `ok`.

- [ ] **Step 3: Review checkpoint**

`git status --porcelain` — new `.github/workflows/ci.yml`.

---

### Task 4: Template smoke workflow

**Files:**
- Create: `.github/workflows/smoke-templates.yml`

- [ ] **Step 1: Create `.github/workflows/smoke-templates.yml`**

```yaml
name: smoke-templates

on:
  # Run manually after a release to verify templates install the freshly
  # published packages: gh workflow run smoke-templates.yml
  workflow_dispatch:
  pull_request:
    paths:
      - "templates/**"
      - "packages/create/**"
      - "scripts/smoke-create.sh"
      - "scripts/sync-composition.mjs"
      - ".github/workflows/smoke-templates.yml"

jobs:
  smoke:
    # The release PR re-pins templates to a version that isn't on npm yet,
    # so the templates can't install until after publish. Skip it there;
    # dispatch this workflow after the release instead.
    if: github.event_name == 'workflow_dispatch' || github.head_ref != 'changeset-release/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install headless-gl build deps
        run: sudo apt-get update && sudo apt-get install -y libxi-dev libglu1-mesa-dev libglew-dev pkg-config
      - run: pnpm install --frozen-lockfile
      - run: ./scripts/smoke-create.sh
```

- [ ] **Step 2: Validate the YAML parses**

Run:
```bash
ruby -ryaml -e 'YAML.load_file(".github/workflows/smoke-templates.yml"); puts "ok"'
```
Expected: `ok`.

- [ ] **Step 3: Review checkpoint**

`git status --porcelain` — new workflow file.

---

### Task 5: Release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write # push the version branch, tags, GitHub release
  pull-requests: write # open/update the Version Packages PR
  id-token: write # npm trusted publishing (OIDC)

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          # With a fine-grained PAT in CHANGESETS_PAT, pushes to the release
          # PR trigger CI (the default token's pushes don't). Optional; see
          # RELEASING.md.
          token: ${{ secrets.CHANGESETS_PAT || github.token }}
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install headless-gl build deps
        run: sudo apt-get update && sudo apt-get install -y libxi-dev libglu1-mesa-dev libglew-dev pkg-config
      - run: pnpm install --frozen-lockfile
      # Publishing uses npm trusted publishing (OIDC) — there is no NPM_TOKEN.
      # Without a ~/.npmrc, changesets/action writes one with a bogus
      # _authToken=${NPM_TOKEN}; pre-creating a benign file keeps it out of
      # pnpm's way so OIDC auth is used.
      - name: Guard ~/.npmrc for OIDC
        run: echo "registry=https://registry.npmjs.org/" > ~/.npmrc
      - name: Version PR or publish
        id: changesets
        uses: changesets/action@v1
        with:
          version: pnpm run release:version
          publish: pnpm run release:publish
          commit: "release: version packages"
          title: "release: version packages"
          # per-package releases are noise in a lockstep repo; we create one
          # aggregate vX.Y.Z release below instead
          createGithubReleases: false
        env:
          GITHUB_TOKEN: ${{ secrets.CHANGESETS_PAT || secrets.GITHUB_TOKEN }}
      - name: Create GitHub release
        if: steps.changesets.outputs.published == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION="$(node -p "require('./packages/core/package.json').version")"
          gh release create "v$VERSION" --title "v$VERSION" --generate-notes
```

How this behaves per push to `main`:
- Pending changesets exist → action runs `pnpm run release:version` and opens/updates the **release PR** on branch `changeset-release/main` (bumps the fixed group, writes per-package CHANGELOGs via changelog-github, re-pins templates, refreshes lockfile).
- No pending changesets and versions ahead of npm (i.e. the release PR just merged) → action runs `pnpm run release:publish`; `changeset publish` publishes each package via `pnpm publish` with OIDC, creates per-package git tags (pushed by the action), then our step creates one aggregate `vX.Y.Z` GitHub release with auto-generated notes.
- Neither → no-op.

- [ ] **Step 2: Validate the YAML parses**

Run:
```bash
ruby -ryaml -e 'YAML.load_file(".github/workflows/release.yml"); puts "ok"'
```
Expected: `ok`.

- [ ] **Step 3: Review checkpoint**

`git status --porcelain` — new workflow file.

---

### Task 6: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

Voice rules (from the smoove-writing skill): plain, direct, second person, no em dashes, no marketing fluff.

- [ ] **Step 1: Create `CONTRIBUTING.md`**

````markdown
# Contributing to smoove

Thanks for helping. This guide covers the mechanics: getting set up, making a
change, and getting it merged. Repo layout and engineering conventions live in
[AGENTS.md](./AGENTS.md); read that before touching code.

## Setup

You need Node 22+ and pnpm 10. `corepack enable` picks the right pnpm from the
`packageManager` field.

```bash
git clone https://github.com/smoove-dev/smoove.git
cd smoove
pnpm install
pnpm build
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Studio reference app |
| `pnpm dev:docs` | Docs site at http://localhost:5176 |
| `pnpm build` | Build all packages |
| `pnpm check` | Biome lint + format check |
| `pnpm format` | Biome auto-format |

The demo imports each package's built entry, not source. After editing
`packages/*/src`, run `pnpm build` (or keep `tsc -b --watch` running in the
package) to see the change.

## Making a change

1. Branch off `main`. Name it by intent: `feat/...`, `fix/...`, `docs/...`,
   `chore/...`.
2. Make the change. Follow the conventions in AGENTS.md.
3. If you touched a published package, add a changeset (next section).
4. Run `pnpm check` and `pnpm build` locally.
5. Open a PR against `main`. PRs are squash merged, so the PR title becomes
   the commit message. Make it descriptive.

## Changesets

Every PR that changes a published package needs a changeset. It records the
bump level and a summary that becomes the changelog entry.

```bash
pnpm changeset
```

Pick the package(s) you touched, pick a bump level, write a short summary
aimed at users of the library, and commit the generated `.changeset/*.md`
file with your PR.

Bump levels while smoove is pre-1.0:

- **patch**: bug fixes, internal changes, docs in published packages
- **minor**: new features, and anything that breaks existing behavior
- **major**: reserved for 1.0

All `@smoove/*` packages and `create-smoove` are versioned in lockstep and
released together, so your changeset moves the whole set to one new version.
That is expected.

Changes that only touch the docs site, the demo app, CI, or `templates/`
need no changeset. If the changeset CI check flags your PR anyway, a
maintainer can apply the `no-changeset` label.

## CI

Every PR runs:

- **build**: `pnpm build` across all packages
- **check**: Biome lint + format
- **changeset**: fails when a published package changed with no changeset
- **smoke-templates**: scaffolds and builds the create-smoove templates,
  only when `templates/` or `packages/create` change

## Releases

Maintainers release by merging the automated "Version Packages" PR; see
[RELEASING.md](./RELEASING.md). You never bump versions or publish by hand.
````

- [ ] **Step 2: Verify the file renders (quick markdown sanity)**

Run:
```bash
head -5 CONTRIBUTING.md
```
Expected: the title and intro lines.

- [ ] **Step 3: Review checkpoint**

`git status --porcelain` — new `CONTRIBUTING.md`.

---

### Task 7: RELEASING.md

**Files:**
- Create: `RELEASING.md`

- [ ] **Step 1: Create `RELEASING.md`**

````markdown
# Releasing smoove

Releases are automated with [Changesets](https://github.com/changesets/changesets).
You never run `npm publish` or edit version fields by hand.

## How a release happens

1. PRs merge into `main`, each carrying a changeset.
2. On every push to `main`, the `release` workflow keeps a
   **"release: version packages"** PR open (branch `changeset-release/main`).
   It accumulates all pending changesets: bumps every package in the fixed
   group to the same next version, writes per-package `CHANGELOG.md` entries,
   re-pins `templates/*` to the new version, and refreshes the lockfile.
3. **Merging that PR is the release.** The workflow then builds, publishes
   all packages to npm through trusted publishing (OIDC, no token), pushes
   per-package git tags, and creates one `vX.Y.Z` GitHub release with
   auto-generated notes.

Release every few PRs, or after one important fix. The release PR just keeps
accumulating until you merge it. To hold a release, leave the PR open.

## One-time setup

### npm trusted publisher (once per package)

For each of `@smoove/core`, `@smoove/player`, `@smoove/transitions`,
`@smoove/renderer`, `@smoove/studio`, `@smoove/google-fonts`, `@smoove/vite`,
and `create-smoove`:

1. npmjs.com → the package → Settings → Trusted publisher → GitHub Actions.
2. Organization or user: `smoove-dev`
3. Repository: `smoove`
4. Workflow filename: `release.yml` (the filename only, not the full path)
5. Environment: leave empty

Until every package is registered, the publish step fails with 404 or
permission errors. That is the misconfiguration signal, not a code bug.

Do not add an `NPM_TOKEN` secret. Publishing authenticates via OIDC.

### GitHub repo settings

- Settings → Actions → General → Workflow permissions: select
  "Read and write permissions" and check
  "Allow GitHub Actions to create and approve pull requests".
- Create the `no-changeset` label (used to skip the changeset CI check):
  `gh label create no-changeset --description "PR needs no changeset"`.

### Branch protection

Require PRs and green checks on `main`. Via ruleset (or the UI under
Settings → Rules → Rulesets):

```bash
gh api -X POST repos/smoove-dev/smoove/rulesets --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_type": "RepositoryRole", "actor_id": 5, "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "build" },
          { "context": "check" },
          { "context": "changeset" }
        ]
      }
    }
  ]
}
JSON
```

The `bypass_actors` entry lets repo admins push directly in an emergency;
remove it for strict enforcement. Review count is 0 because smoove currently
has a single maintainer; raise it when that changes.

### CI on the release PR (optional but recommended)

GitHub does not trigger workflows for pushes made with the default Actions
token, so the release PR's required checks stay pending and block the merge.
Two ways out:

- **Recommended:** create a fine-grained PAT (repo `smoove-dev/smoove`,
  permissions: Contents read/write, Pull requests read/write) and save it as
  the `CHANGESETS_PAT` repo secret. `release.yml` already prefers it, and CI
  then runs on the release PR normally.
- Without the PAT: push an empty commit to `changeset-release/main` to
  trigger CI (`git commit --allow-empty -m "ci" && git push`), or merge with
  admin bypass.

## Prereleases

To ship `0.x.y-next.N` versions under the `next` dist-tag:

```bash
pnpm exec changeset pre enter next   # commit via PR
# merge feature PRs with changesets as usual; the release PR now produces
# -next.N versions and publishes them to the next tag
pnpm exec changeset pre exit         # commit via PR to leave pre mode
```

Pre mode is recorded in `.changeset/pre.json`; the whole repo is in or out.

## When a publish fails partway

Some packages published, then the job died: re-run the failed workflow run.
`changeset publish` checks the registry per package and skips versions that
already exist, so it resumes where it stopped.

## After a release

- Run the template smoke test against the freshly published packages:
  `gh workflow run smoke-templates.yml` (or `./scripts/smoke-create.sh`
  locally).
- Known small race: the release commit lands template pins on `main` a few
  minutes before npm publish completes. `npm create smoove` in that window
  can fail to install. It heals itself once publish finishes.

## Sharp edges

- `changeset publish` shells out to `pnpm publish` (detected from the pnpm
  workspace), which is what rewrites `workspace:*` ranges to real versions.
  Never commit a `yarn.lock` or `package-lock.json` at the root; it flips
  that detection.
- The publish scripts are `release:version` and `release:publish` on
  purpose. Do not rename them to `version` or `publish`; both collide with
  npm lifecycle hooks.
- Templates are fetched from `main` at scaffold time by `create-smoove`, so
  template changes ship on merge, without a release.
````

- [ ] **Step 2: Review checkpoint**

`git status --porcelain` — new `RELEASING.md`.

---

### Task 8: End-to-end dry run of the version step

Verifies the whole `release:version` chain locally, then reverts. The
changelog generator is swapped for the built-in one during the dry run so no
GITHUB_TOKEN is needed.

- [ ] **Step 1: Preflight — record what a revert must clean up**

Run:
```bash
git status --porcelain
git ls-files | grep -i changelog
```
Expected: second command prints nothing (no tracked CHANGELOG.md files exist today). If any exist, note them; the cleanup step must not delete those.

- [ ] **Step 2: Temporarily switch to the token-free changelog generator**

In `.changeset/config.json`, change the `changelog` line to:
```json
  "changelog": "@changesets/cli/changelog",
```
(Revert in Step 7.)

- [ ] **Step 3: Create a throwaway changeset**

Create `.changeset/dry-run-test.md`:
```markdown
---
"@smoove/core": patch
---

Dry-run changeset for verifying the release wiring. Never merged.
```

- [ ] **Step 4: Run the version step**

Run:
```bash
pnpm run release:version
```
Expected output/effects:
- All 8 fixed-group packages move `0.1.6` → `0.1.7` (check `git diff packages/*/package.json`).
- `@smoove/docs` stays `0.1.6` (ignored) and `demo` stays `0.0.0`.
- `packages/core/CHANGELOG.md` created with the dry-run entry; the other 7 get CHANGELOGs too (fixed-group bump entries).
- `templates/*/package.json` `@smoove/*` pins now `^0.1.7`.
- `.changeset/dry-run-test.md` was consumed (deleted).
- `pnpm-lock.yaml` unchanged or trivially touched.

- [ ] **Step 5: Verify the numbers**

Run:
```bash
grep -h '"version"' packages/*/package.json | sort | uniq -c
grep -rn '"@smoove/core"' templates/*/package.json
```
Expected: eight `"version": "0.1.7"`, one `"version": "0.1.6"` (docs); template pins `^0.1.7`.

- [ ] **Step 6: Revert the dry run**

Run:
```bash
git restore packages templates pnpm-lock.yaml
git status --porcelain | awk '$1 == "??" && $2 ~ /CHANGELOG\.md$/ { print $2 }' | xargs rm -v
```
Then confirm: `git status --porcelain` shows the same set as the Step 1 snapshot (minus `.changeset/dry-run-test.md`, which changesets deleted).

- [ ] **Step 7: Restore the changelog generator**

Put the `changelog` line in `.changeset/config.json` back to:
```json
  "changelog": ["@changesets/changelog-github", { "repo": "smoove-dev/smoove" }],
```

- [ ] **Step 8: Final sanity**

Run:
```bash
pnpm exec changeset status
pnpm check
```
Expected: status exits 0 (no changesets); Biome passes on all new files (workflows are YAML, ignored by Biome; the new .mjs and .md must pass or be formatted with `pnpm format`).

---

### Task 9: Wrap-up review (no commits)

- [ ] **Step 1: Full diff review**

Run:
```bash
git status --porcelain
git diff --stat
```
Expected new files: `.changeset/config.json`, `.changeset/README.md`, `scripts/sync-template-versions.mjs`, 3 workflows, `CONTRIBUTING.md`, `RELEASING.md`, this plan + the spec. Expected modified: `package.json`, `pnpm-lock.yaml`. Expected deleted: `scripts/bump.mjs`.

- [ ] **Step 2: Report to Rotem**

Summarize the change set and list the manual actions only he can do:
1. Register the trusted publisher for all 8 packages on npmjs.com (`release.yml`, org `smoove-dev`, repo `smoove`).
2. Repo Settings → Actions → General → enable "Read and write" + "Allow GitHub Actions to create and approve pull requests".
3. Create the `no-changeset` label and the branch-protection ruleset (commands in RELEASING.md).
4. Optionally add the `CHANGESETS_PAT` secret so CI runs on the release PR.
5. Commit and push when satisfied (his call, per repo rules); the first PR through the new pipeline is the real end-to-end test, and the first release will be 0.1.7.
