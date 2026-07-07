# Alpha-Stage Indications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface smoove's alpha status (APIs can change between releases) in the root README and across the docs site.

**Architecture:** Pure prose/UI additions, no engine changes. Four surfaces: a README blockquote, a dismissible Fumadocs `Banner` in the docs layout, an "alpha" chip in the home hero pill, and `Callout` blocks on the two docs entry pages. Spec: `docs/superpowers/specs/2026-07-07-alpha-stage-indications-design.md`.

**Tech Stack:** Markdown, MDX (Fumadocs), React (React Router framework mode), plain CSS.

**Prose rules (apply to every string in this plan):** smoove voice. No em or en dashes, no other framework names, no unmeasured numbers. The canonical message: "smoove is in alpha. APIs can change between releases while the engine settles. Pin exact versions and check the release notes when you upgrade."

**Commits:** Do NOT commit at any step. Rotem commits on request only (standing preference overrides the usual per-task commit steps).

**No tests:** these are prose/presentation changes with no unit-testable logic. Verification is visual, via the docs dev server (Task 5).

---

### Task 1: Root README alpha notice

**Files:**
- Modify: `README.md` (insert after the `<hr />`, line 18)

- [x] **Step 1: Insert the blockquote**

After the `<hr />` line and its trailing blank line, before the paragraph starting `A **Composition** is a...`, insert:

```markdown
> **smoove is in alpha.** APIs can change between releases while the engine
> settles. Pin exact versions and check the release notes when you upgrade.
```

Keep a blank line above and below the blockquote.

- [x] **Step 2: Self-check the prose**

Confirm the inserted text has no em/en dashes and no framework names. Render check is covered in Task 5.

### Task 2: Docs pages banner

**Files:**
- Modify: `packages/docs/src/routes/docs.tsx`

- [x] **Step 1: Import Banner**

Add to the imports in `packages/docs/src/routes/docs.tsx`:

```tsx
import { Banner } from "fumadocs-ui/components/banner";
```

- [x] **Step 2: Mount the banner above DocsLayout**

Change the default `Page` component's return to:

```tsx
return (
  <>
    <Banner id="smoove-alpha">
      smoove is in alpha: APIs can change between releases.
    </Banner>
    <DocsLayout {...baseOptions()} tree={pageTree}>
      {clientLoader.useContent(path)}
    </DocsLayout>
  </>
);
```

Notes: `id="smoove-alpha"` makes the banner dismissible and persists the dismissal in localStorage. `changeLayout` defaults to true, which offsets the Fumadocs sticky nav below the banner; do not override it.

- [x] **Step 3: Typecheck**

Run: `pnpm --filter @smoove/docs typecheck` (if no such script, `pnpm --filter @smoove/docs exec tsc --noEmit` or the package's build).
Expected: no new type errors.

### Task 3: Home hero alpha chip

**Files:**
- Modify: `packages/docs/src/routes/home.tsx` (the `.pill` span, around line 91)
- Modify: `packages/docs/src/styles/base.css` (after the `.pill .ver` rule, around line 384)

- [x] **Step 1: Add the chip to the hero pill**

In `home.tsx`, change:

```tsx
<span className="pill">
  <span className="dot" /> smoove <span className="ver">v{version}</span>
</span>
```

to:

```tsx
<span className="pill">
  <span className="dot" /> smoove <span className="ver">v{version}</span>
  <span className="alpha">alpha</span>
</span>
```

- [x] **Step 2: Style the chip**

In `base.css`, directly after the `.pill .ver` rule, add:

```css
.pill .alpha {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-2);
  border: 1px solid var(--line-2);
  border-radius: 999px;
  padding: 1px 6px;
}
```

Uses only existing CSS variables (`--accent-2`, `--line-2`), so it inherits both themes.

### Task 4: Entry-page callouts

**Files:**
- Modify: `packages/docs/content/docs/introduction.mdx`
- Modify: `packages/docs/content/docs/installation.mdx`

- [x] **Step 1: Add the callout to introduction.mdx**

Directly after the frontmatter closing `---` (and a blank line), before the first paragraph, insert:

```mdx
<Callout type="warn" title="smoove is in alpha">
  APIs can change between releases while the engine settles. Pin exact
  versions and check the release notes when you upgrade.
</Callout>
```

- [x] **Step 2: Add the same callout to installation.mdx**

Same placement, same content as Step 1. `Callout` is already registered in `packages/docs/src/components/mdx.tsx`, no import needed in MDX.

### Task 5: Verify in the browser

**Files:** none (verification only)

- [x] **Step 1: Start the docs dev server**

Use the preview tools (`preview_start`; docs dev runs on port 5176, `pnpm dev:docs`). Check `preview_logs` for build errors.

- [x] **Step 2: Verify docs banner**

Load `/docs/introduction`. Confirm: banner text renders at the top, the sticky nav sits below it (not overlapped), the dismiss button removes it, and it stays dismissed after reload. Clear the `smoove-alpha` localStorage key afterward (`preview_eval`) so the banner is back for real visitors' testing and screenshots.

- [x] **Step 3: Verify entry-page callouts**

Confirm the warn callout renders under the page title on `/docs/introduction` and `/docs/installation`.

- [x] **Step 4: Verify home hero chip**

Load `/`. Confirm the pill reads `smoove v0.1.x alpha` with the chip styled, in both dark (default) and light themes (`preview_resize` with `colorScheme`, or toggle the theme).

- [x] **Step 5: Final prose sweep**

Grep the four touched prose surfaces for em/en dashes:
Run: `grep -n "—\|–" README.md packages/docs/content/docs/introduction.mdx packages/docs/content/docs/installation.mdx packages/docs/src/routes/docs.tsx`
Expected: no matches in the newly added text (pre-existing occurrences elsewhere in those files, if any, are out of scope).
