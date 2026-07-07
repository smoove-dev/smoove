# Alpha-stage indications

Date: 2026-07-07
Status: approved

## Goal

smoove is in alpha. Make that visible where people first meet the project:
the root README and the docs site. The notice states that APIs can change
between releases and advises pinning exact versions.

## Message

One core line, adapted per surface, written in the smoove voice (no em or
en dashes, no filler, no framework comparisons):

> smoove is in alpha. APIs can change between releases while the engine
> settles. Pin exact versions and check the release notes when you upgrade.

Tone decision: state that breaking changes are expected. No feedback-invite
variant, no soft "early days" phrasing.

## Surfaces

### 1. Root README.md

A blockquote notice inserted directly after the `<hr />` (currently line
18), before the Composition/Sequence explainer, so it is visible above the
fold on GitHub. Full three-sentence message. No shields badge.

### 2. Docs pages banner (packages/docs)

Mount the Fumadocs `Banner` component (`fumadocs-ui/components/banner`,
available in installed fumadocs-ui 16.10.7) in
`packages/docs/src/routes/docs.tsx`, wrapping or preceding `DocsLayout` so
every docs page shows it. One line: "smoove is in alpha: APIs can change
between releases." Pass `id="smoove-alpha"` so dismissal persists in
localStorage.

### 3. Home hero alpha chip (packages/docs)

The home page keeps its fixed hero background and custom `HomeHeader`, so
no banner bar there. Instead, add a small "alpha" chip next to the existing
version badge in `packages/docs/src/routes/home.tsx` (the
`smoove <span className="ver">v{version}</span>` element, currently line
91). Style it with the existing home.css vocabulary.

### 4. Docs entry-page callouts

Add an inline callout at the top of the body (after frontmatter) in:

- `packages/docs/content/docs/introduction.mdx`
- `packages/docs/content/docs/installation.mdx`

Form: `<Callout type="warn" title="smoove is in alpha">` with the
pin-exact-versions body. `Callout` is already registered in the MDX
component map (`packages/docs/src/components/mdx.tsx`), so no wiring
needed.

## Out of scope

- The 9 package READMEs (explicitly deselected).
- `doc/` internal docs, package.json descriptions, npm keywords.
- Any versioning or changelog process changes.

## Verification

Run the docs dev server (`pnpm dev:docs`, port 5176) and confirm:

- The banner renders on docs pages, is dismissible, and stays dismissed
  after reload.
- The alpha chip renders next to the version in the home hero, in both
  light and dark themes.
- The callouts render on the introduction and installation pages.
- README renders correctly (markdown preview is enough).

Prose passes the smoove-writing self-check: zero em/en dashes, no other
framework names, no unmeasured numbers.
