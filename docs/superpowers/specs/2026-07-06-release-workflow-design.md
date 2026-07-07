# Release workflow design

Date: 2026-07-06
Status: approved

## Goal

Move smoove from manual laptop releases (`pnpm bump` + `pnpm release`) to a
standard open-source flow: every change lands via a PR from a branch, and
releases happen by merging an automatically maintained release PR that bumps
versions, writes changelogs, and publishes to npm from CI.

## Current state

- pnpm workspace; 8 publishable packages (`@smoove/core`, `@smoove/player`,
  `@smoove/transitions`, `@smoove/renderer`, `@smoove/studio`,
  `@smoove/google-fonts`, `@smoove/vite`, `create-smoove`), all lockstep at
  0.1.6. `@smoove/docs` and `demo` are private workspace members.
- `scripts/bump.mjs` bumps every `packages/*` version in lockstep and re-pins
  `templates/*` `@smoove/*` deps to `^<version>` (templates live outside the
  workspace and install published versions).
- `pnpm release` builds and publishes all packages from the local machine.
- Only CI is `docs-ci.yml`. No PR checks, no changelogs, no branch protection.

## Decisions (made with Rotem)

1. **Release tooling: Changesets + CI publish.** Contributors add a changeset
   file per PR; a bot-maintained "Version Packages" PR accumulates them;
   merging it versions, changelogs, and publishes.
2. **Versioning: lockstep (fixed).** All publishable packages share one
   version, as today.
3. **PR checks: build, Biome, changeset presence, template smoke test** (the
   smoke test path-filtered to `templates/**` changes, since it installs
   published versions and proves nothing about package-source PRs).
4. **npm auth: trusted publishing (OIDC)** — no long-lived token, provenance
   attestations for free. One-time registration per package on npmjs.com.
5. **Docs: `CONTRIBUTING.md` + `RELEASING.md`** only (no PR/issue templates,
   no AGENTS.md changes for now).

## Design

### Branching + PR model

- `main` is protected and always releasable.
- Every feature/bugfix is a branch off `main` (`feat/...`, `fix/...`,
  `docs/...`, `chore/...`), merged via PR. Squash merge recommended.
- Branch protection (require PRs, require CI checks green) is a GitHub
  setting; `RELEASING.md` includes the exact `gh api` commands to enable it.

### Changesets configuration

- Add `@changesets/cli` and `@changesets/changelog-github` as root dev deps;
  `changeset init` then edit `.changeset/config.json`:
  - `fixed`: an explicit list of the 8 publishable packages (a `@smoove/*`
    glob would pull in the private `@smoove/docs`, conflicting with
    `ignore`).
  - `ignore: ["@smoove/docs", "demo"]` — the private members are never
    versioned and never require changesets.
  - `changelog: ["@changesets/changelog-github", { repo: "smoove-dev/smoove" }]`
    — per-package `CHANGELOG.md` entries linking PRs and authors (needs
    `GITHUB_TOKEN` in env during `changeset version`; available in CI).
  - `access: "public"`, `baseBranch: "main"`.
- Contributor flow: `pnpm changeset` in the PR branch → pick bump level
  (patch/minor/major) → write a one-paragraph summary → commit the generated
  `.changeset/*.md` file with the PR.

### Template version sync

Changesets doesn't know about `templates/*` (outside the workspace, pin
literal `^<version>` ranges). Extract the templates half of `bump.mjs` into
`scripts/sync-template-versions.mjs`, which reads the current
`packages/core/package.json` version and re-pins every
`templates/*/package.json` `@smoove/*` dep to `^<version>`.

Root `package.json` gets:

```json
"release:version": "changeset version && node scripts/sync-template-versions.mjs && pnpm install --lockfile-only",
"release:publish": "pnpm build && changeset publish"
```

(neither script may be named `version` or `publish` — both collide with npm
lifecycle hooks) and `release.yml` configures `changesets/action` with
`version: pnpm run release:version` and `publish: pnpm run release:publish`, so the
template pins ride along in the same release commit. `scripts/bump.mjs` is
deleted (history keeps it); the `bump` and `release` scripts are removed
from root `package.json` (nobody publishes from a laptop anymore —
`release:publish` exists for the action and fails locally without OIDC).

### CI on PRs — `.github/workflows/ci.yml`

Triggers: `pull_request` + `push` to `main`. Jobs:

1. **build** — pnpm install (with store cache), `pnpm build`.
2. **check** — `pnpm check` (Biome lint + format).
3. **changeset** — fails if the PR modifies `packages/**` but adds no
   `.changeset/*.md` file; skipped when the PR carries a `no-changeset`
   label (docs/chore PRs) or when the PR is the release PR
   (`changeset-release/main` branch). Implemented with
   `changeset status --since=origin/main` plus the label escape hatch.
4. **smoke-templates** — `./scripts/smoke-create.sh` in its own
   path-filtered workflow, running only when `templates/**`,
   `packages/create/**`, or the smoke/sync scripts change. It is **skipped
   on the release PR**: that PR re-pins templates to a version not yet on
   npm, so the templates cannot install until after publish. Instead it has
   a `workflow_dispatch` trigger for a post-release check.

Required status checks on `main`: build, check, changeset.

### Release — `.github/workflows/release.yml`

Trigger: `push` to `main`. Single job using
`changesets/action@v1`:

- **Pending changesets exist** → the action runs the root `version` script
  and opens/updates the **"Version Packages" PR** (branch
  `changeset-release/main`): bumps all fixed-group packages, writes
  `CHANGELOG.md`s, re-pins templates. The PR body previews the release.
- **Release PR merged** (no pending changesets, versions ahead of npm) → the
  action runs `pnpm run release:publish` (build + `changeset publish`).
  `changeset publish` shells out to `pnpm publish` per package (workspace
  tool detection), which rewrites `workspace:*` ranges and authenticates via
  **npm trusted publishing (OIDC)**: `permissions: id-token: write`, no
  `NPM_TOKEN` (pnpm 10 supports OIDC; the repo pins 10.33.4). Provenance is
  automatic. Per-package git tags are pushed; `createGithubReleases` is off
  and a follow-up step creates one aggregate `v<version>` GitHub Release
  with `gh release create --generate-notes` (per-package releases are noise
  in a lockstep repo).

Cadence: releasing "every few PRs" = merging the Version Packages PR
whenever desired; it keeps accumulating until then.

One-time setup (documented in RELEASING.md): on npmjs.com, for each of the
8 packages, add a trusted publisher: GitHub repo `smoove-dev/smoove`,
workflow `release.yml`. Until that's done the publish step fails with
auth errors — expected, not a bug.

### Docs

- **`CONTRIBUTING.md`** (root): dev setup (pnpm, Node version, `pnpm build`,
  `pnpm dev`), branch-per-change + PR flow, adding a changeset (with bump
  level guidance: patch = fix, minor = feature, major = breaking), code
  style (Biome, `pnpm check`), what CI runs, and a note that maintainers
  handle releases.
- **`RELEASING.md`** (root): how the Version Packages PR works and how
  merging it releases; prerelease flow (`changeset pre enter next` /
  `pre exit`); trusted-publisher registration steps; branch-protection
  `gh api` commands; recovery from a partial publish (re-run the workflow —
  `changeset publish` skips versions already on npm).

### Error handling

- Publish fails mid-way (some packages published, some not): re-run the
  release workflow; `changeset publish` only publishes packages whose
  version is absent from npm, so it resumes cleanly.
- Contributor forgets a changeset: CI check fails with a message linking
  CONTRIBUTING.md; maintainer can apply the `no-changeset` label or push a
  changeset to the branch.
- A merged PR needed a different bump level: add a correcting changeset in
  a follow-up PR before merging the release PR.

### Testing / verification

- `changeset version` dry run locally on a scratch branch: verify lockstep
  bump across all 8 packages, template pins updated, private packages
  untouched.
- `changeset publish --dry-run` is not supported; instead verify
  `changeset status` output and rely on the first real release (0.1.7) as
  the end-to-end test, watching the Actions log.
- CI workflow logic exercised by opening a test PR (with and without a
  changeset, with the `no-changeset` label).

## Out of scope

- Unit tests / Vitest (repo has none yet; AGENTS.md says don't scaffold
  preemptively).
- PR/issue templates, CODEOWNERS, AGENTS.md edits.
- Independent per-package versioning.
- Canary/snapshot releases (can add `changeset publish --tag next` later).
