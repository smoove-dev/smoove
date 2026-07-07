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

## Adding a new package

When a new package lands under `packages/*`:

1. Add its name to the `fixed` group in `.changeset/config.json` so it
   versions in lockstep with the rest. If it's private (like `@smoove/docs`),
   add it to `ignore` instead.
2. Set its initial `version` in `package.json` to the current release line so
   the next lockstep bump lines up.
3. For publishable packages, register the trusted publisher on npmjs.com
   (same steps as above). The very first publish of a brand-new package name
   may need to happen before a trusted publisher can be configured for it;
   if the release workflow fails on the new package only, publish it once
   manually with `pnpm --filter <name> publish` from a logged-in machine,
   then add the trusted publisher.

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
