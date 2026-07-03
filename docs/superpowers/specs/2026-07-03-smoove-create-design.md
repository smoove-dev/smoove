# create-smoove — template scaffolding CLI

Date: 2026-07-03
Status: approved

## Goal

`npm create smoove <template>` scaffolds a ready-to-run smoove project so a
new user goes from nothing to an animating composition in one command. Two
templates at launch:

- **studio** — the full studio experience, same architecture as the `demo`
  app: React Router SSR, `<Studio>` UI, and server-side rendering via
  `@smoove/renderer`.
- **composition** — a minimal Vite app for authoring a single composition
  with `<smoove-player>` preview and autoreload. Available in TypeScript and
  JavaScript variants.

Every scaffolded project points the user (and their coding agent) at the
`smoove-video` skill.

## Decisions (from brainstorming)

- **Distribution: fetch from GitHub at run time** (degit-style), not embedded
  in the npm tarball. Templates update the moment `main` changes; no CLI
  republish needed.
- **Sample content: one very simple composition, shared by all templates** —
  the smoove logo (`assets/smoove-mark.svg`) scaling/fading in with the
  "smoove" wordmark in the brand font animating in below it.
- **Composition template ships TS and JS variants**, selected by prompt or
  `--ts`/`--js` flag.
- **Skill install goes through `npx skills add smoove-dev/smoove`** so the
  skills CLI's own agent picker handles Claude Code / Cursor / Codex / etc.
  The command is also documented in each template's README.md and AGENTS.md.

## Architecture

### CLI package — `packages/create` → `create-smoove`

- Published **unscoped** as `create-smoove` (name confirmed free on npm) so
  the `create` shorthand works everywhere from day one:
  `npm create smoove [template] [dir]`, `pnpm create smoove`,
  `yarn create smoove`, and `npx create-smoove`. It is the one deliberate
  exception to the `@smoove/*` scope — npm's `create` mapping requires the
  unscoped `create-<name>` form.
- Flags: `--ts` / `--js` (composition only), `--no-install`, `--no-git`,
  `--no-skill`. Anything missing becomes a prompt (`@clack/prompts`):
  template picker, target directory, language.
- Flow:
  1. Resolve template + target dir (prompt for gaps; non-empty dir → ask
     overwrite/abort).
  2. Fetch `gh:smoove-dev/smoove/templates/<name>` via `giget`.
  3. Patch `package.json` `name` from the directory name.
  4. `git init` (unless `--no-git` or already inside a repo).
  5. Install deps with the package manager detected from
     `npm_config_user_agent` (unless `--no-install`).
  6. Offer the skill install; on yes, run `npx skills add smoove-dev/smoove`
     with inherited stdio so its interactive agent picker runs.
  7. Print next steps: `cd`, dev command, skill command if skipped, docs link
     (https://smoove.dev).
- Dev/test escape hatch: `SMOOVE_CREATE_TEMPLATE_DIR=<path>` copies templates
  from a local checkout instead of GitHub, so unmerged template changes are
  testable.
- Deps: `giget`, `@clack/prompts`, `picocolors`. Build: `tsc -b`, publish
  `dist/`, same conventions as the other packages.

### Templates — `templates/` at repo root

**Not in the pnpm workspace.** Templates depend on published `@smoove/*`
versions (`^0.1.2`), never `workspace:*`, so a raw fetch is immediately
installable. Keeping them out of `pnpm-workspace.yaml` stops pnpm from
linking local packages and masking broken version ranges.

- `templates/studio` — the demo app trimmed to one composition: React Router
  SSR, `<Studio>` + `defineRegistry()` registry, server render queue +
  `/api/render*` routes, `@smoove/vite` plugin.
- `templates/composition-ts` — Vite vanilla-ts: `index.html`,
  `src/main.ts` mounting `<smoove-player>` with controls,
  `src/composition.ts`, `vite.config.ts`. No server render.
- `templates/composition-js` — same app in JavaScript. The two variants are
  small (~4 files) and kept in sync by hand.
- Shared sample composition code is identical across all three (the JS copy
  is the TS file with types stripped).
- Each template ships:
  - `README.md` — quick start, how to render, skill install command, docs
    link. Written per the smoove-writing skill.
  - `AGENTS.md` — one-paragraph smoove mental model + instruction to install
    the smoove-video skill.

### Repo housekeeping

- Add `packages/create` and `templates/` rows to the AGENTS.md layout table.
- Extend `scripts/bump.mjs` to also rewrite `@smoove/*` ranges in
  `templates/*/package.json` (templates use literal ranges, not
  `workspace:*`, so the lockstep bump must cover them or releases strand
  the templates on the old version line).
- `scripts/` gains a smoke-test script: scaffold each template from the local
  `templates/` dir into a temp dir, install, build. Run manually / in CI
  before releases.

## Error handling

- Fetch failure (offline, GitHub down): clear message with the repo URL and a
  manual-clone fallback.
- Non-empty target directory: prompt overwrite/abort (abort in
  non-interactive use).
- Skill install failure: non-fatal — warn and print the command for later.
- Install failure: non-fatal — print the install command and continue to the
  summary.

## Testing

- Smoke script (above) exercises scaffold → install → build for all three
  template variants.
- CLI unit-level logic (arg parsing, package.json patching, PM detection) is
  small; add Vitest in `packages/create` only if the logic grows enough to
  warrant it (repo convention: no preemptive test scaffolding).

## Out of scope

- Additional templates (docs site starter, Next.js embed, etc.).
- A scoped `@smoove/create` alias package (`npm create @smoove`) — can be
  added later as a thin re-export if wanted.
- Auto-updating `@smoove/*` version ranges in templates from the registry at
  scaffold time; bumping them in-repo is enough since fetch tracks `main`.
