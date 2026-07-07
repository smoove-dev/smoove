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
