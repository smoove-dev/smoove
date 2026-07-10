# SmooveEditor Phase 1 (Scaffold) — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> **Repo overrides:** AGENTS.md forbids `git commit` unless explicitly asked — this plan has **no commit steps**. AGENTS.md also says don't scaffold Vitest preemptively — Phase 1 has little branchable logic, so verification is *builds, lints, boots, streams*. Vitest arrives in Phase 2 with `ProjectFs`.

**Goal:** Stand up `@smoove/editor` — a studio-shaped but **opinionated** package exposing `setupAi()`, a directly-callable agent toolkit, and a chat rail built on **AI Elements** — and exercise it from an editor section inside `kitchen-sink`.

**Architecture:** `@smoove/editor` mirrors `@smoove/studio`'s shape (React barrel at `.`, Node-only barrel at `./server`, Tailwind at `./styles.css`) but is deliberately more opinionated: it ships `setupAi({ registry, models, tools })`, `getDefaultSmooveEditorTools()`, and a pre-composed `<Editor.ChatRail>`. Chat UI comes from **AI Elements vendored into the package** (Apache-2.0, copy-in by design) and re-themed onto smoove's tokens via a CSS bridge, so consumers install nothing extra. The wire protocol is the **AI SDK UI message stream** (`useChat` + `toUIMessageStream`), not a bespoke SSE contract. There is **no dedicated dev app** — `kitchen-sink` hosts an `/editor` route that is the reference `templates/editor` will later be extracted from.

**Tech Stack:** `ai@^7`, `@ai-sdk/react@^4` (`useChat`, `DefaultChatTransport`), `@ai-sdk/{anthropic,openai,google,openai-compatible}`, `zod@^4`, AI Elements (vendored), **React 19**, React Router 7, Tailwind v4, TypeScript project references.

---

## Scope warning — read before starting

This plan contains **two independent changes**. Land and verify them separately.

- **Part A (React 19)** touches the whole workspace and is independently revertable. It has nothing to do with the editor except that AI Elements requires React 19. **Finish and verify Part A before starting Part B.** It is a reasonable candidate for its own PR.
- **Parts B–F** are the editor itself.

## Decisions locked in this phase

| Decision | Choice | Why |
| --- | --- | --- |
| Branch | `feat/smoove-editor` (exists, identical to `main`) | Feature work off main. |
| Package | `packages/editor` → `@smoove/editor` (publishable) | Mirrors the studio split. |
| Dev harness | An `/editor` section in `kitchen-sink`. **No `editor-app`.** | One less package; the section seeds `templates/editor`. |
| Template | Deferred to a later phase | `templates/*` sit outside the pnpm workspace and resolve *published* `@smoove/*` versions, so `templates/editor` can't be installed or smoke-tested until `@smoove/editor` ships. Authoring it now would be blind. |
| Chat UI | **AI Elements, vendored into `packages/editor/src/components/ai-elements/`** | Apache-2.0 and copy-in by design. Keeps "the package exposes the parts" — consumers run no `shadcn init`. |
| Theming | A **CSS bridge** maps shadcn's `--background`/`--muted`/… onto smoove's `@theme` tokens | Re-themes AI Elements *without editing their source*, so the fork stays clean and re-syncable. |
| Wire protocol | **AI SDK UI message stream** (`useChat` ↔ `toUIMessageStream`) | Replaces the bespoke `AgentEvent` SSE union. Tool calls, streaming, and abort come free; `sendMessage(text, { body })` carries `modelId` + `EditorContext`. Also removes the hand-rolled `ReadableStream`, and with it the `cancel()` dev-server trap. |
| Model definition | **Bring your own AI SDK model.** `defineModel(model, meta?)` only attaches picker metadata. No `ProviderConfig`, no `resolveModel`. | The AI SDK *is* the model API; wrapping it re-invents it badly. The user calls `anthropic(…)` / `google(…)` / `createOpenAICompatible(…).chatModel(…)` — or passes a gateway id string — and configures it however they like. Consequence: **`@smoove/editor` no longer depends on any `@ai-sdk/*` provider package**; those move to the app. |
| `ai` dependency | **peerDependency**, not a dependency | Two copies of `ai` would make `LanguageModel` structurally incompatible across the package boundary — the same duplicate-instance failure the repo already has with `vite`/`@types/node`. |
| `models: [...]` | A **required, user-selectable list** surfaced in `PromptInputSelect` | Mixed hosted + local in one editor. No env-sniffing inside the package; the app decides. |
| Tools | `getDefaultSmooveEditorTools()`; each tool's logic **also exported as a plain function** | "Expose the full agent toolkit" + "call direct functions from the package". |
| Phase 1 toolkit | **Read-only**: `listCompositions`, `getTimeline` | Proves the full tool-calling contract with zero write risk. `ProjectFs` + write tools are Phase 2. |
| Timeline context | The **browser sends** an `EditorContext` snapshot per turn | Only the browser knows the playhead. Avoids constructing a Konva `Composition` server-side (needs the renderer's server-rendering setup). |
| Theme sharing | Extract `packages/studio/src/theme.css`, export as `@smoove/studio/theme.css` | Tailwind v4 needs `@theme` values at compile time to emit `bg-bg-1` utilities. Editor must import the tokens, not duplicate them. |

## Verified facts (probed against the real toolchain — do not "correct" these)

- `ai@7.0.19` exports **`isStepCount`**; `stepCountIs` is only an alias. `maxSteps` is gone — use `stopWhen: isStepCount(n)`. It also exports `LanguageModel`, `UIMessage`, `convertToModelMessages`, `toUIMessageStream`, `createUIMessageStreamResponse`, `DefaultChatTransport`, `ToolUIPart`.
- Local/self-hosted path (Ornith 1.0, Qwen3-Coder): `createOpenAICompatible({ name, baseURL, apiKey }).chatModel(id)` from `@ai-sdk/openai-compatible@3`.
- `type LanguageModel = GlobalProviderModelId | LanguageModelV4 | LanguageModelV3 | LanguageModelV2` — i.e. **a plain gateway id string is a valid model**. The object forms all expose `readonly provider: string` and `readonly modelId: string` (`@ai-sdk/provider@4.0.3`), so `defineModel` can derive a stable `id` as `` `${provider}/${modelId}` `` without the caller repeating it.
- **AI Elements** = shadcn registry, **not** an npm package. `npx ai-elements@latest` copies source into the configured components dir. Requires React 19, Tailwind 4 in **CSS-variables mode**, and shadcn/ui (`components.json`). Its components import `@/components/ui/*` (Radix) and `lucide-react`. **License: Apache-2.0** → vendoring is permitted, with attribution and a note of modifications.
- **Base UI supports React 19**: `@base-ui/react@1.5.0` peers are `react: ^17 || ^18 || ^19`. The repo-wide bump will not break studio.
- **React 19 is already in this repo**: `packages/docs` runs `19.2.7` and `templates/studio` runs `^19.2.7`. **Only `kitchen-sink` pins React 18** (`^18.3.1`).
- **Studio/editor build with `tsc -b`, not a bundler.** tsc does **not** rewrite path aliases, so vendored `@/components/ui/...` imports would fail at runtime. They must be rewritten to relative imports (Task B4 Step 4). (`packages/player` builds with Vite lib mode — that's the alternative if rewriting proves unworkable.)
- `StudioProps.render` is optional; `Studio` needs only `registry`.
- `Sequence` runs updaters via **`.register(fn)`**, not `registerUpdater`.
- Biome enforces `noInvalidPositionAtImportRule`: in `studio.css`, `@import "./theme.css"` **must precede** the `@source` at-rules.
- **`pnpm --filter <app> run typecheck` is already broken repo-wide** — kitchen-sink fails today on `Outlet`/`ServerRouter` TS2786 (a stray `@types/react@19` against its React 18 pin) plus a dual-`vite` TS2769 in `vite.config.ts`. `pnpm build` does *not* run it. **Part A may fix the TS2786 errors**; the TS2769 will remain.
- Biome's `organizeImports` is an **assist** action: `pnpm format` will not apply it, but `pnpm check` fails on it. Use `pnpm exec biome check --write <file>`.

## File structure

**`packages/editor` (new, publishable)**

| File | Responsibility |
| --- | --- |
| `package.json` | Exports `.`, `./server`, `./styles.css`. No provider SDKs; `ai`/`@ai-sdk/react` are peers. |
| `tsconfig.json` | `composite`, references `../core`, `../studio`. |
| `components.json` | shadcn config, so the AI Elements CLI writes inside this package. |
| `NOTICE` | Apache-2.0 attribution + statement of modification for the vendored tree. |
| `src/types.ts` | `ModelMeta`, `ModelSpec`, `ModelInfo`, `SequenceInfo`, `EditorContext`, `EditorChatBody`, `AgentInput`, `AiRuntime`. No React, no Node. |
| `src/lib/utils.ts` | `cn()` — what the vendored shadcn components import. |
| `src/editor.css` | Tailwind entry: studio theme + shadcn bridge + `@source`. |
| `src/shadcn-bridge.css` | Maps shadcn's CSS vars onto smoove's tokens. |
| `src/components/ai-elements/**` | **Vendored, unmodified** (imports rewritten only). |
| `src/components/ui/**` | **Vendored** shadcn primitives the elements depend on. |
| `src/components/chat/chat-rail.tsx` | The one composed part: rail = Conversation + Tool + PromptInput. |
| `src/hooks/use-editor-context.ts` | Snapshots composition/frame/sequences from the studio store. |
| `src/server/models.ts` | `defineModel(model, meta?)` — metadata only. |
| `src/server/tools/context.ts` | `EditorToolContext` — what tools are handed. |
| `src/server/tools/compositions.ts` | `listCompositions(ctx)` — plain function. |
| `src/server/tools/timeline.ts` | `getTimeline(ctx)` — plain function. |
| `src/server/tools/index.ts` | `getDefaultSmooveEditorTools(ctx)` — wraps the plain functions as `tool()`s. |
| `src/server/ai.ts` | `setupAi()` → `AiRuntime`. Transport-agnostic (NO HTTP). |
| `src/server/index.ts` | Node-only barrel. Re-exports `setupAi`, `defineModel`, the toolkit, **and every plain tool function**. |
| `src/index.ts` | React barrel: `Editor` compound + hooks + types. |

**`packages/kitchen-sink` (modified — the editor section)**

| File | Responsibility |
| --- | --- |
| `src/server/ai.server.ts` | Owns the providers; builds `ModelSpec[]` with `defineModel`; calls `setupAi()` once. |
| `src/routes/api.agent.ts` | `POST` → AI SDK UI message stream. |
| `src/routes/api.agent.models.ts` | `GET` → `ModelInfo[]` (no keys). |
| `src/layouts/editor-layout.tsx` | `<Studio>` + `<Editor.ChatRail>` + `Outlet` (rail replaces the sidebar). |
| `src/routes/editor.tsx` | Stage + Timeline in the center. |
| `src/routes.ts` | Adds the editor layout + the two API routes. |
| `src/layouts/studio-layout.tsx` | Adds an "Editor" NavItem. |
| `src/root.tsx` | Imports `@smoove/editor/styles.css`. |
| `package.json` | Adds `@smoove/editor`, `ai`, `@ai-sdk/react`, and the provider SDKs. |
| `.env.example` | Documents the provider keys. |

**Modified (workspace)**

- `packages/studio/src/studio.css`, `packages/studio/src/theme.css` (new), `packages/studio/package.json`
- `.changeset/config.json` (add `@smoove/editor` to `fixed`)
- `tsconfig.json` (add `./packages/editor` reference)
- `biome.json` (exclude the vendored tree)

---

# Part A — React 19 repo-wide

**Land and verify this before touching Part B.**

> **Callout for the maintainer:** you asked for a repo-wide baseline. Note that `@smoove/studio` contains no React-19-only code, so its peer could honestly stay `>=18` and nothing would break. Bumping it to `>=19` is a **breaking change for existing studio consumers** and needs a `minor` (pre-1.0) changeset with a migration note. Only `@smoove/editor` strictly requires 19. If you'd rather not break studio users, keep `studio` at `>=18` and set only `editor` to `>=19` — the rest of this plan is unaffected either way.

## Task A1: Bump kitchen-sink to React 19

**Files:** Modify `packages/kitchen-sink/package.json`

- [ ] **Step 1: Update the React deps**

```json
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.0",
  }
```
(Leave every other dependency untouched.)

- [ ] **Step 2: Install**

```bash
cd /Users/rotem/development/konva-motion
pnpm install
```

- [ ] **Step 3: Verify only one React major resolves for kitchen-sink**

```bash
node -p "require('./packages/kitchen-sink/node_modules/react/package.json').version"
node -p "require('./packages/kitchen-sink/node_modules/@types/react/package.json').version"
```
Expected: both `19.x`.

## Task A2: Bump studio's React peer + types

**Files:** Modify `packages/studio/package.json`

- [ ] **Step 1: Update**

```json
  "peerDependencies": {
    "react": ">=19",
    "react-dom": ">=19"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.0"
  }
```

- [ ] **Step 2: Install + rebuild studio**

```bash
pnpm install && pnpm --filter @smoove/studio run build
```
Expected: exit 0.

## Task A3: Verify the bump

- [ ] **Step 1: Whole-workspace build**

```bash
pnpm build
```
Expected: exit 0.

- [ ] **Step 2: Capture the new typecheck baseline**

```bash
pnpm --filter @smoove/kitchen-sink run typecheck 2>&1 | grep -E "^[a-z].*error TS" | sed 's/(.*//' | sort | uniq -c
```
Expected: the TS2786 `Outlet`/`ServerRouter` errors **should be gone** (they were a React-18-app-vs-React-19-types mismatch). `vite.config.ts` TS2769 and `composition.ts` TS2532 will remain — both pre-existing and out of scope. **Write down whatever remains; that is the new baseline** used in Task F3.

- [ ] **Step 3: Boot and smoke the existing studio**

```bash
pnpm dev
```
Load `http://localhost:5174`, open a composition, confirm the stage renders and the timeline scrubs. Then stop the server. (React 19 changes hydration behavior; this is the check that matters.)

- [ ] **Step 4: Changeset for the breaking peer bump**

```bash
pnpm changeset
```
Select `@smoove/studio`, bump `minor`, summary: `Require React 19 (peer). Base UI and all smoove apps already support it.`

---

# Part B — The `@smoove/editor` package shell

## Task B1: Confirm the branch

- [ ] **Step 1**

```bash
cd /Users/rotem/development/konva-motion
git rev-parse --verify feat/smoove-editor >/dev/null 2>&1 && git checkout feat/smoove-editor || git checkout -b feat/smoove-editor
git branch --show-current
```
Expected: `feat/smoove-editor`.

## Task B2: Extract the studio theme

**Files:** Create `packages/studio/src/theme.css`; modify `packages/studio/src/studio.css`, `packages/studio/package.json`

- [ ] **Step 1: Create `packages/studio/src/theme.css`** — move the two theme blocks (`studio.css:25–65`) verbatim:

```css
/* ============================================================
   @smoove/studio — design tokens (the single source of truth).

   Imported by studio.css, and by any sibling package that compiles
   Tailwind utilities against these tokens (e.g. @smoove/editor).
   Tailwind v4 needs the @theme values at compile time to emit utilities
   like `bg-bg-1`, so a consumer must import this rather than rely on the
   compiled :root vars.
   ============================================================ */

@theme {
  /* ---- Surfaces (deepest → raised) ---- */
  --color-stage: #0c0c0f;
  --color-bg-0: #100f14;
  --color-bg-1: #17161c;
  --color-bg-2: #1e1d25;
  --color-bg-3: #2a2933;
  --color-line: color-mix(in oklab, #ffffff 8%, transparent);
  --color-line-2: color-mix(in oklab, #ffffff 13%, transparent);

  /* ---- Ink ---- */
  --color-ink-1: #eceaf2;
  --color-ink-2: #a4a2b2;
  --color-ink-3: #6b6a78;

  /* ---- Accent + status (change --color-accent to reskin) ---- */
  --color-accent: #ff5640;
  --color-accent-2: #15cda8;
  --color-good: #46d39a;
  --color-warn: #ffb44d;
  --color-danger: #ff6b6b;

  /* ---- Shape: route every corner through these two ---- */
  --radius-ui: 10px;
  --radius-control: 7px;

  /* ---- Type ---- */
  --font-display: "Comfortaa", system-ui, sans-serif;
  --font-sans: "Hanken Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* ---- Frame metrics ---- */
  --spacing-sidebar: 256px;
  --spacing-panel: 320px;
}

/* Tints derived from accent — regenerate automatically when accent changes. */
@theme inline {
  --color-accent-soft: color-mix(in oklab, var(--color-accent) 16%, transparent);
  --color-accent-line: color-mix(in oklab, var(--color-accent) 40%, transparent);
}
```

- [ ] **Step 2: In `studio.css`, delete both `@theme` blocks; add the import ABOVE the `@source` rules**

Biome's `noInvalidPositionAtImportRule` rejects an `@import` that follows `@source`. Result:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);

/* Tokens live in theme.css so sibling packages (@smoove/editor) can compile
   their own utilities against the same @theme. Exported as "./theme.css".
   Must precede @source — @import has to come before other at-rules. */
@import "./theme.css";

/* Scan only this package's own source for class names. */
@source "./components";
@source "./hooks";
@source "./lib";
@source "./index.ts";

@layer base {
  /* …unchanged… */
```

- [ ] **Step 3: `packages/studio/package.json`**

```json
    "./styles.css": "./dist/styles/studio.css",
    "./theme.css": "./src/theme.css"
  },
  "files": [
    "dist",
    "src/theme.css"
  ],
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @smoove/studio run build:css
grep -c -- "--color-accent:" packages/studio/dist/styles/studio.css   # expect 1
grep -c "bg-bg-2" packages/studio/dist/styles/studio.css              # expect 1
pnpm exec biome check packages/studio/src/studio.css                  # expect clean
```

## Task B3: Package manifest, tsconfig, `cn` util

**Files:** Create `packages/editor/package.json`, `packages/editor/tsconfig.json`, `packages/editor/src/lib/utils.ts`

- [ ] **Step 1: `packages/editor/package.json`**

`version` is `0.1.7` to match the `fixed` changesets group. The AI Elements CLI will **add more dependencies** in Task B4 — that is expected; capture whatever it adds.

```json
{
  "name": "@smoove/editor",
  "version": "0.1.7",
  "description": "LLM-driven composition editor for smoove: chat rail, agent toolkit, and BYO-model wiring.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/smoove-dev/smoove.git",
    "directory": "packages/editor"
  },
  "homepage": "https://smoove.dev",
  "bugs": "https://github.com/smoove-dev/smoove/issues",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "import": "./dist/server/index.js"
    },
    "./styles.css": "./dist/styles/editor.css"
  },
  "files": [
    "dist",
    "NOTICE"
  ],
  "scripts": {
    "build": "tsc -b && pnpm run build:css",
    "build:css": "tailwindcss -i ./src/editor.css -o ./dist/styles/editor.css --minify",
    "dev": "concurrently -k \"tsc -b --watch --preserveWatchOutput\" \"tailwindcss -i ./src/editor.css -o ./dist/styles/editor.css --watch\"",
    "clean": "rm -rf dist *.tsbuildinfo",
    "prepublishOnly": "pnpm build"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.24.0",
    "tailwind-merge": "^3.6.0",
    "zod": "^4.4.3"
  },
  "peerDependencies": {
    "@ai-sdk/react": "^4",
    "@smoove/core": "workspace:^",
    "@smoove/studio": "workspace:^",
    "ai": "^7",
    "react": ">=19",
    "react-dom": ">=19"
  },
  "devDependencies": {
    "@ai-sdk/react": "^4.0.20",
    "@smoove/core": "workspace:*",
    "@smoove/studio": "workspace:*",
    "@tailwindcss/cli": "^4.3.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.0",
    "ai": "^7.0.19",
    "concurrently": "^9.1.0",
    "tailwindcss": "^4.3.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

> **No `@ai-sdk/*` provider packages.** The consumer picks their providers and passes models in via `defineModel`. `ai` and `@ai-sdk/react` are **peers** so exactly one copy exists in the app's tree — otherwise `LanguageModel` from the app's `ai` won't be assignable to `LanguageModel` from editor's `ai`.

- [ ] **Step 2: `packages/editor/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["react", "react-dom", "node"]
  },
  "include": ["src"],
  "exclude": ["src/editor.css", "src/shadcn-bridge.css"],
  "references": [{ "path": "../core" }, { "path": "../studio" }]
}
```

- [ ] **Step 3: `packages/editor/src/lib/utils.ts`** — the `cn` shadcn components expect

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's class merger. Vendored AI Elements import this as `@/lib/utils`;
    the vendoring step rewrites that to a relative path. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Verify**

```bash
test -f packages/editor/package.json && test -f packages/editor/tsconfig.json && echo OK
```

## Task B4: Vendor AI Elements

This is the riskiest task. Work slowly and verify each step.

**Files:** Create `packages/editor/components.json`, `packages/editor/NOTICE`, `packages/editor/src/components/ai-elements/**`, `packages/editor/src/components/ui/**`

- [ ] **Step 1: `packages/editor/components.json`**

Aliases point at this package's `src`, so the CLI writes inside the package. `cssVariables: true` is mandatory — AI Elements supports CSS-variables mode only.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/editor.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Create `src/editor.css` before running the CLI**

The CLI reads `tailwind.css` from `components.json`. Full contents land in Task B5; for now it must at least exist:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "../../studio/src/theme.css";
```

- [ ] **Step 3: Run the AI Elements CLI inside the package**

```bash
cd packages/editor
npx ai-elements@latest add conversation message response prompt-input tool
```

If the CLI insists on a Next.js project or otherwise refuses, fall back to the shadcn registry directly:

```bash
npx shadcn@latest add https://elements.ai-sdk.dev/r/conversation.json
# …repeat for message, response, prompt-input, tool
```

Expected: files appear under `src/components/ai-elements/` and `src/components/ui/`, and **new dependencies are appended to `packages/editor/package.json`** (Radix packages, `streamdown`, `use-stick-to-bottom`, etc.).

- [ ] **Step 4: Rewrite `@/` aliases to relative imports — REQUIRED**

`tsc -b` does not rewrite path aliases, so `@/components/ui/button` would be emitted verbatim and fail to resolve at runtime.

```bash
cd packages/editor
# @/components/ui/x  -> ../ui/x   (from src/components/ai-elements/*)
find src/components/ai-elements -name '*.tsx' -o -name '*.ts' | xargs sed -i '' \
  -e 's#"@/components/ui/#"../ui/#g' \
  -e 's#"@/components/ai-elements/#"./#g' \
  -e 's#"@/lib/utils"#"../../lib/utils.js"#g'
# @/lib/utils -> ../../lib/utils  (from src/components/ui/*)
find src/components/ui -name '*.tsx' -o -name '*.ts' | xargs sed -i '' \
  -e 's#"@/lib/utils"#"../../lib/utils.js"#g'
```

- [ ] **Step 5: Verify no alias imports survive, and add `.js` extensions**

```bash
cd packages/editor
grep -rn '"@/' src/ && echo "FAIL: alias imports remain" || echo "OK: no alias imports"
```
Expected: `OK: no alias imports`.

The repo emits ESM via `tsc` with `moduleResolution: bundler`, and every existing source file imports with an explicit `.js` extension (see `packages/studio/src/index.ts`). Add `.js` to the rewritten relative imports so the emitted output resolves under Node ESM. Re-run the grep until clean:

```bash
grep -rn 'from "\.\./ui/[a-z-]*"' src/ | head    # these need a .js suffix
```

- [ ] **Step 6: Apache-2.0 attribution — `packages/editor/NOTICE`**

Vendoring Apache-2.0 code requires retaining the license and **stating that you modified it**.

```text
@smoove/editor

This product includes software developed by Vercel, Inc.

The files under src/components/ai-elements/ and src/components/ui/ are
derived from AI Elements (https://github.com/vercel/ai-elements), licensed
under the Apache License, Version 2.0:

    https://www.apache.org/licenses/LICENSE-2.0

Modifications by the smoove authors:
  - Import paths rewritten from "@/..." aliases to relative specifiers so the
    package can be compiled with `tsc` and published to npm.
  - Theming is supplied by src/shadcn-bridge.css, which maps shadcn's CSS
    variables onto smoove's design tokens. Component source is otherwise
    unmodified, to keep the vendored copy re-syncable upstream.
```

- [ ] **Step 7: Verify the CLI's dependency additions were captured**

```bash
cd /Users/rotem/development/konva-motion
git diff --stat packages/editor/package.json
pnpm install
```
Expected: `dependencies` gained Radix/streamdown/etc. Record them; they are now part of the package's published surface.

## Task B5: The theme bridge + Tailwind entry

**Files:** Create `packages/editor/src/shadcn-bridge.css`; finalize `packages/editor/src/editor.css`

This is what makes vendored AI Elements *look like smoove* without editing a single vendored line.

- [ ] **Step 1: `src/shadcn-bridge.css`**

```css
/* ============================================================
   shadcn → smoove token bridge.

   AI Elements (vendored, unmodified) style themselves with shadcn's CSS
   variables: bg-background, text-muted-foreground, border-border, …
   Rather than fork their class names, we point those variables at smoove's
   design tokens. Re-theming smoove re-themes AI Elements for free, and the
   vendored source stays byte-comparable with upstream.
   ============================================================ */

:root {
  --background: var(--color-bg-0);
  --foreground: var(--color-ink-1);

  --card: var(--color-bg-1);
  --card-foreground: var(--color-ink-1);
  --popover: var(--color-bg-2);
  --popover-foreground: var(--color-ink-1);

  --primary: var(--color-accent);
  --primary-foreground: #ffffff;
  --secondary: var(--color-bg-2);
  --secondary-foreground: var(--color-ink-1);

  --muted: var(--color-bg-1);
  --muted-foreground: var(--color-ink-3);
  --accent: var(--color-bg-2);
  --accent-foreground: var(--color-ink-1);

  --destructive: var(--color-danger);
  --destructive-foreground: #ffffff;

  --border: var(--color-line);
  --input: var(--color-line-2);
  --ring: var(--color-accent-line);

  --radius: var(--radius-ui);
}

/* Tailwind v4: expose the bridged vars as utilities (bg-background, …). */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

> **Conflict to check in Step 3:** smoove's own `@theme` already defines `--color-accent` (the red `#ff5640`). shadcn's `--color-accent` means "a muted hover surface." The bridge above **overrides smoove's `accent`**, which would turn every `bg-accent` in editor's own components into a grey surface. Resolve by *not* bridging `accent`/`accent-foreground` to shadcn semantics — instead name them `--color-surface-hover` in the bridge and patch the two or three vendored usages, **or** rename smoove's usage in editor's own components to `bg-primary`. Decide, then make the classes agree. Do not leave both definitions live.

- [ ] **Step 2: Final `src/editor.css`**

```css
/* ============================================================
   @smoove/editor — Tailwind v4 source. Compiled at build to
   dist/styles/editor.css and shipped via the "./styles.css" export.

   Theme tokens are NOT redeclared here — they're imported from
   @smoove/studio, which owns them. shadcn-bridge.css re-points shadcn's
   variables at those tokens so the vendored AI Elements inherit the look.

   The relative import into the studio workspace source is intentional:
   editor's CSS is compiled inside this monorepo at build/publish time, and
   consumers only ever eat the compiled dist/styles/editor.css. External
   consumers who want to recolor import "@smoove/studio/theme.css".
   ============================================================ */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "../../studio/src/theme.css";
@import "./shadcn-bridge.css";

@source "./components";
@source "./hooks";
@source "./index.ts";
```

- [ ] **Step 3: Verify the accent conflict is resolved**

```bash
cd packages/editor
grep -rn "bg-accent\b" src/components/ | head
```
Decide per the callout in Step 1 and make the classes consistent. Then:

```bash
pnpm run build:css
grep -c "bg-background" dist/styles/editor.css   # expect 1
grep -c "bg-bg-0" dist/styles/editor.css         # expect 1 (smoove tokens still work)
```

---

# Part C — `setupAi`, the toolkit, and the protocol

## Task C1: The shared contract — `src/types.ts`

**Files:** Create `packages/editor/src/types.ts`

- [ ] **Step 1: Write it**

```ts
/** @smoove/editor — the shared browser↔server contract. No React, no Node. */
import type { LanguageModel, UIMessage } from "ai";

/** Optional metadata for `defineModel`. Everything is derived when omitted. */
export type ModelMeta = {
  /** Stable key the browser sends back. Defaults to `<provider>/<modelId>`. */
  id?: string;
  /** Display name in the picker. Defaults to the id. */
  label?: string;
  description?: string;
};

/** A model the app offers. Build these with `defineModel`; the end user picks
    one in the chat rail's PromptInputSelect. `model` is any AI SDK
    `LanguageModel` — a provider instance or a gateway id string. */
export type ModelSpec = {
  /** Stable key the browser sends back to select this model. */
  id: string;
  /** Display name in the picker. */
  label: string;
  description?: string;
  model: LanguageModel;
};

/** The key-free projection of a ModelSpec that is safe to send to the browser. */
export type ModelInfo = Pick<ModelSpec, "id" | "label">;

/** A sequence's range within the composition, in frames. */
export type SequenceInfo = {
  name: string;
  from: number;
  durationInFrames: number;
};

/** The live snapshot the browser sends each turn — only it knows the playhead. */
export type EditorContext = {
  compositionId: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  sequences: SequenceInfo[];
};

/** The extra `body` the chat rail attaches to each `sendMessage`. */
export type EditorChatBody = {
  modelId?: string;
  context?: EditorContext;
};

/** What the agent endpoint receives: useChat's UIMessages + our extra body. */
export type AgentInput = EditorChatBody & {
  messages: UIMessage[];
};

/** Transport-agnostic runtime. The host wraps `stream()` in a UI message
    stream response — same rule as `@smoove/studio/server`: NO HTTP here. */
export type AiRuntime = {
  /** Key-free model list for the picker. */
  models(): ModelInfo[];
  /** Returns the raw `streamText` result; the host converts it to a response. */
  stream(input: AgentInput, signal?: AbortSignal): Promise<StreamTextResultOf>;
};

/** The `streamText` return type, without re-deriving its generics. */
export type StreamTextResultOf = Awaited<ReturnType<typeof import("ai").streamText>> extends never
  ? never
  : ReturnType<typeof import("ai").streamText>;
```

> **Simplify if the last type fights you:** `streamText` returns synchronously, so `StreamTextResultOf = ReturnType<typeof streamText>` with a normal top-level import is fine. Use whichever typechecks; do not change `AiRuntime`'s shape.

## Task C2: `defineModel` — `src/server/models.ts`

**Files:** Create `packages/editor/src/server/models.ts`

The package has **no opinion about providers**. It takes AI SDK models and only
attaches the metadata the picker needs.

- [ ] **Step 1: Write it**

```ts
import type { LanguageModel } from "ai";
import type { ModelMeta, ModelSpec } from "../types.js";

/**
 * Attach picker metadata to any AI SDK model. Bring your own provider —
 * configure it however the SDK lets you:
 *
 *   defineModel(anthropic("claude-opus-4-8"))
 *   defineModel(google("gemini-2.5-pro"), { label: "Gemini 2.5 Pro" })
 *   defineModel(ornith.chatModel("ornith-1.0"), { label: "Ornith 1.0 (local)" })
 *   defineModel("openai/gpt-4o")            // gateway model id string
 *
 * `id` defaults to `<provider>/<modelId>` (or the string itself), and `label`
 * defaults to `id`, so the common case needs no metadata at all.
 */
export function defineModel(model: LanguageModel, meta: ModelMeta = {}): ModelSpec {
  const derived = typeof model === "string" ? model : `${model.provider}/${model.modelId}`;
  const id = meta.id ?? derived;
  return { id, label: meta.label ?? id, description: meta.description, model };
}
```

> `LanguageModel` is `GlobalProviderModelId | LanguageModelV4 | V3 | V2`. The
> `typeof model === "string"` check narrows the gateway-id case; the object forms
> all carry `readonly provider` / `readonly modelId` (verified in
> `@ai-sdk/provider@4.0.3`).

## Task C3: The agent toolkit

**Files:** Create `src/server/tools/{context,compositions,timeline,index}.ts`

Each tool's logic is a **plain exported function** taking `(ctx)`; `getDefaultSmooveEditorTools(ctx)` only wraps them as AI-SDK `tool()`s.

- [ ] **Step 1: `tools/context.ts`**

```ts
import type { Registry } from "@smoove/studio";
import type { EditorContext } from "../../types.js";

/** What every tool is handed. `context` is the per-turn browser snapshot and is
    absent when a tool is called directly, outside a conversation. */
export type EditorToolContext = {
  registry: Registry;
  context?: EditorContext;
};
```

- [ ] **Step 2: `tools/compositions.ts`**

```ts
import type { EditorToolContext } from "./context.js";

export type CompositionSummary = {
  id: string;
  title?: string;
  group?: string;
  description?: string;
  tags?: string[];
};

/** Plain function — callable directly, no LLM required. */
export function listCompositions(ctx: EditorToolContext): CompositionSummary[] {
  return ctx.registry.entries().map((e) => ({
    id: e.id,
    title: e.title,
    group: e.group,
    description: e.description,
    tags: e.tags,
  }));
}
```

- [ ] **Step 3: `tools/timeline.ts`**

```ts
import type { EditorContext } from "../../types.js";
import type { EditorToolContext } from "./context.js";

/** Plain function — returns the browser's per-turn snapshot of the playhead.
    Throws when called outside a conversation (no snapshot was supplied). */
export function getTimeline(ctx: EditorToolContext): EditorContext {
  if (!ctx.context) {
    throw new Error("No editor context for this turn — the timeline is unknown.");
  }
  return ctx.context;
}
```

- [ ] **Step 4: `tools/index.ts`**

```ts
import { tool } from "ai";
import { z } from "zod";
import { listCompositions } from "./compositions.js";
import type { EditorToolContext } from "./context.js";
import { getTimeline } from "./timeline.js";

/** The opinionated default toolkit. Phase 1 is read-only; Phase 2 adds the
    ProjectFs-backed write tools (readFile/writeFile/editFile/scaffold/typecheck). */
export function getDefaultSmooveEditorTools(ctx: EditorToolContext) {
  return {
    listCompositions: tool({
      description: "List the compositions in the project's registry.",
      inputSchema: z.object({}),
      execute: async () => listCompositions(ctx),
    }),
    getTimeline: tool({
      description:
        "Get the active composition's timeline: current frame, fps, total duration, and each sequence's frame range.",
      inputSchema: z.object({}),
      execute: async () => getTimeline(ctx),
    }),
  };
}

export type EditorToolSet = ReturnType<typeof getDefaultSmooveEditorTools>;

export { type CompositionSummary, listCompositions } from "./compositions.js";
export type { EditorToolContext } from "./context.js";
export { getTimeline } from "./timeline.js";
```

## Task C4: `setupAi()` + server barrel

**Files:** Create `src/server/ai.ts`, `src/server/index.ts`

- [ ] **Step 1: `src/server/ai.ts`**

The toolkit is rebuilt per turn so tools close over that turn's `EditorContext`.

```ts
import type { Registry } from "@smoove/studio";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import type { AgentInput, AiRuntime, ModelInfo, ModelSpec } from "../types.js";
import { type EditorToolContext, getDefaultSmooveEditorTools } from "./tools/index.js";

export type SetupAiOptions = {
  /** The composition catalog the tools read. */
  registry: Registry;
  /** User-selectable models, built with `defineModel`. The first is the default. */
  models: ModelSpec[];
  /** Override the toolkit. Receives the per-turn context. */
  tools?: (ctx: EditorToolContext) => Record<string, unknown>;
  /** Override the built-in system prompt. Phase 2 injects the smoove-video skill. */
  system?: string;
  /** Max tool-calling steps per turn. */
  maxSteps?: number;
};

const DEFAULT_SYSTEM = [
  "You are smoove, an assistant that authors timeline-driven Konva animations.",
  "Use listCompositions and getTimeline to ground yourself before answering.",
  "You cannot edit files yet — answer conversationally and concisely.",
].join("\n");

/**
 * The opinionated entry point. Transport-agnostic: returns the `streamText`
 * result and lets the host turn it into a UI message stream response — same
 * rule as `@smoove/studio/server` (NO HTTP).
 */
export function setupAi(options: SetupAiOptions): AiRuntime {
  const models = options.models;
  if (models.length === 0) throw new Error("setupAi: `models` must not be empty");

  const system = options.system ?? DEFAULT_SYSTEM;
  const maxSteps = options.maxSteps ?? 16;
  const makeTools = options.tools ?? getDefaultSmooveEditorTools;

  // `models` is non-empty (checked above), so `[0]` is always defined.
  const pick = (id?: string): ModelSpec => models.find((m) => m.id === id) ?? (models[0] as ModelSpec);

  return {
    models(): ModelInfo[] {
      return models.map(({ id, label }) => ({ id, label }));
    },

    async stream(input: AgentInput, signal?: AbortSignal) {
      const spec = pick(input.modelId);
      const tools = makeTools({ registry: options.registry, context: input.context });

      return streamText({
        model: spec.model,
        system,
        messages: await convertToModelMessages(input.messages),
        tools: tools as Parameters<typeof streamText>[0]["tools"],
        stopWhen: isStepCount(maxSteps),
        abortSignal: signal,
      });
    },
  };
}
```

> **Risk, resolve at build time:** the AI SDK docs show `messages: await convertToModelMessages(messages)`. If it turns out to be synchronous in `ai@7`, drop the `await` — `stream()` stays `async` regardless.

- [ ] **Step 2: `src/server/index.ts`**

Run `pnpm exec biome check --write` on this file afterwards (`organizeImports`).

```ts
/** @smoove/editor/server — Node-only. Contracts + runtime + toolkit, NO HTTP.
    The host app wires the transport (see kitchen-sink's routes/api.agent.ts).

    Every tool is exported twice: as part of getDefaultSmooveEditorTools() for
    the agent, and as a plain function you can call directly. */

export type * from "../types.js";
export { type SetupAiOptions, setupAi } from "./ai.js";
export { defineModel } from "./models.js";
export {
  type CompositionSummary,
  type EditorToolContext,
  type EditorToolSet,
  getDefaultSmooveEditorTools,
  getTimeline,
  listCompositions,
} from "./tools/index.js";
```

---

# Part D — The chat rail, on AI Elements

## Task D1: `useEditorContext`

**Files:** Create `packages/editor/src/hooks/use-editor-context.ts`

- [ ] **Step 1: Write it**

```ts
import { sequencesOf, useComposition, usePlayback } from "@smoove/studio";
import { useCallback } from "react";
import type { EditorContext } from "../types.js";

/** Snapshot the live composition + playhead for the agent's per-turn context. */
export function useEditorContext(): () => EditorContext | undefined {
  const composition = useComposition();
  const { frame } = usePlayback();

  return useCallback(() => {
    if (!composition) return undefined;
    return {
      compositionId: composition.id() ?? "",
      frame,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
      sequences: sequencesOf(composition).map((s) => ({
        name: s.name() || "sequence",
        from: s.from,
        durationInFrames: s.durationInFrames,
      })),
    };
  }, [composition, frame]);
}
```

> **Risk, resolve while writing:** confirm the real accessors on `Composition`/`Sequence` (`.id()`, `.fps`, `.durationInFrames`, `.from`) and the signatures of `useComposition()` / `usePlayback()` in `packages/studio/src/hooks/`. Adjust this file to match; do **not** change `EditorContext`.

## Task D2: `<ChatRail>` composed from AI Elements

**Files:** Create `packages/editor/src/components/chat/chat-rail.tsx`

- [ ] **Step 1: Write it**

Imports are relative because the vendored components live in this package.

```tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import { useEffect, useState } from "react";
import { useEditorContext } from "../../hooks/use-editor-context.js";
import type { ModelInfo } from "../../types.js";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../ai-elements/conversation.js";
import { Message, MessageContent, MessageResponse } from "../ai-elements/message.js";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input.js";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../ai-elements/tool.js";

export type ChatRailProps = {
  /** The agent endpoint. `${endpoint}/models` must also exist. */
  endpoint?: string;
};

/** The left rail: model picker, conversation, composer. Replaces studio's Sidebar. */
export function ChatRail({ endpoint = "/api/agent" }: ChatRailProps) {
  const getContext = useEditorContext();
  const [text, setText] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelId, setModelId] = useState<string | undefined>();

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: endpoint }),
  });

  useEffect(() => {
    let live = true;
    fetch(`${endpoint}/models`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ModelInfo[]) => {
        if (!live) return;
        setModels(list);
        setModelId((cur) => cur ?? list[0]?.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [endpoint]);

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;
    sendMessage({ text: message.text }, { body: { modelId, context: getContext() } });
    setText("");
  };

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-r border-line bg-bg-0">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="font-display text-sm text-ink-1">smoove editor</span>
      </header>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Describe the motion"
              description="smoove will build it."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={`${message.id}-${i}`}>{part.text}</MessageResponse>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      const t = part as ToolUIPart;
                      return (
                        <Tool key={`${message.id}-${i}`}>
                          <ToolHeader type={t.type} state={t.state} />
                          <ToolContent>
                            <ToolInput input={t.input} />
                            <ToolOutput output={t.output} errorText={t.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={handleSubmit} className="m-3">
        <PromptInputBody>
          <PromptInputTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the motion…"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {models.length > 0 ? (
              <PromptInputSelect value={modelId} onValueChange={setModelId}>
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((m) => (
                    <PromptInputSelectItem key={m.id} value={m.id}>
                      {m.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            ) : null}
          </PromptInputTools>
          <PromptInputSubmit
            status={status === "streaming" ? "streaming" : "ready"}
            onClick={status === "streaming" ? () => stop() : undefined}
            disabled={status !== "streaming" && !text.trim()}
          />
        </PromptInputFooter>
      </PromptInput>
    </aside>
  );
}
```

> **Risk, resolve after Task B4:** the exact export names and props of the vendored components (`ConversationEmptyState`, `MessageResponse`, `PromptInputSelect*`, `ToolOutput`'s `output`/`errorText`) are whatever the CLI wrote. **Read the vendored files and conform this component to them** — they are the source of truth, not this snippet. Do not modify the vendored files to match this snippet.

## Task D3: The barrel

**Files:** Create `packages/editor/src/index.ts`

- [ ] **Step 1: Write it**, then `pnpm exec biome check --write packages/editor/src/index.ts`

```ts
/** @smoove/editor — public barrel (browser). Server lives at "@smoove/editor/server". */
import { ChatRail } from "./components/chat/chat-rail.js";

/** Compound namespace, mirroring `Studio`. Compose the regions you want. */
export const Editor = {
  ChatRail,
};

export { ChatRail, type ChatRailProps } from "./components/chat/chat-rail.js";
export { useEditorContext } from "./hooks/use-editor-context.js";
export type * from "./types.js";
```

> Do **not** re-export the vendored AI Elements from the public barrel in Phase 1. They're an implementation detail of `<ChatRail>`. If consumers later need them, export them from a dedicated `./elements` subpath so the fork's surface is explicit.

## Task D4: Wire the workspace, install, build

**Files:** Modify `.changeset/config.json`, `tsconfig.json`

- [ ] **Step 1:** In `.changeset/config.json`, insert `"@smoove/editor"` after `"@smoove/studio"` in the single `fixed` array. Leave `ignore` alone.

- [ ] **Step 2:** In the root `tsconfig.json`, insert `{ "path": "./packages/editor" }` after the studio reference. Leave the stale `./packages/timeline` and `./packages/layout` references alone — unrelated cleanup.

- [ ] **Step 3: Install + build**

```bash
cd /Users/rotem/development/konva-motion
pnpm install
pnpm --filter @smoove/editor run build
```
Expected: exit 0.

- [ ] **Step 4: Verify the output**

```bash
ls -1 packages/editor/dist/index.js packages/editor/dist/server/index.js packages/editor/dist/styles/editor.css
grep -rn '"@/' packages/editor/dist/ && echo "FAIL: alias leaked into dist" || echo "OK"
for u in bg-bg-0 bg-background border-line; do
  printf "%-16s %s\n" "$u" "$(grep -c -- "$u" packages/editor/dist/styles/editor.css)"
done
```
Expected: three paths; `OK`; each utility count `1`.

---

# Part E — The editor section in `kitchen-sink`

**Files:**
- Modify: `packages/kitchen-sink/package.json` (add `"@smoove/editor": "workspace:*"`, plus `ai`, `@ai-sdk/react`, and the provider SDKs the app chooses to offer)
- Create: `packages/kitchen-sink/.env.example`, `src/server/ai.server.ts`, `src/routes/api.agent.ts`, `src/routes/api.agent.models.ts`, `src/layouts/editor-layout.tsx`, `src/routes/editor.tsx`
- Modify: `src/routes.ts`, `src/layouts/studio-layout.tsx`, `src/root.tsx`

## Task E1: Env + runtime singleton

- [ ] **Step 1: `.env.example`**

The app owns its providers now, so the env vars are the *provider SDKs'* own
conventions plus whatever this app chooses.

```bash
# Keys never leave the server. Set any subset — each configured provider
# adds an entry to the editor's model picker.

# --- Hosted ---
ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENERATIVE_AI_API_KEY=...

# --- Local / self-hosted (Ornith 1.0, Qwen3-Coder, ...) ---
# Anything behind an OpenAI-compatible /v1 endpoint: Ollama, vLLM,
# LM Studio, SGLang, llama.cpp. The model must support tool calling.
# SMOOVE_LOCAL_MODEL=ornith-1.0
# SMOOVE_LOCAL_BASE_URL=http://localhost:11434/v1
```

- [ ] **Step 2: Add the provider packages to `packages/kitchen-sink/package.json`**

These are the app's choice, not the package's:

```json
    "@ai-sdk/anthropic": "^4.0.11",
    "@ai-sdk/google": "^4.0.11",
    "@ai-sdk/openai-compatible": "^3.0.7",
    "@ai-sdk/react": "^4.0.20",
    "ai": "^7.0.19",
```

- [ ] **Step 3: `src/server/ai.server.ts`**

This is the whole point of `defineModel`: the app calls the AI SDK directly and
configures each provider however it wants.

```ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineModel, type ModelSpec, setupAi } from "@smoove/editor/server";
import registry from "../registry.js";

/** Lazily constructed so a missing key surfaces as a request error rather than
    crashing the dev server at import time. */
let cached: ReturnType<typeof setupAi> | null = null;

function buildModels(): ModelSpec[] {
  const models: ModelSpec[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    models.push(defineModel(anthropic("claude-opus-4-8"), { label: "Claude Opus 4.8" }));
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    models.push(defineModel(google("gemini-2.5-pro"), { label: "Gemini 2.5 Pro" }));
  }

  const baseURL = process.env.SMOOVE_LOCAL_BASE_URL;
  const localModel = process.env.SMOOVE_LOCAL_MODEL;
  if (baseURL && localModel) {
    const local = createOpenAICompatible({ name: "local", baseURL });
    models.push(defineModel(local.chatModel(localModel), { label: `${localModel} (local)` }));
  }

  if (models.length === 0) {
    throw new Error("No model configured — set ANTHROPIC_API_KEY or SMOOVE_LOCAL_BASE_URL.");
  }
  return models;
}

export function getAi() {
  if (!cached) cached = setupAi({ registry, models: buildModels() });
  return cached;
}
```

## Task E2: The two resource routes

- [ ] **Step 1: `src/routes/api.agent.models.ts`**

```ts
import { getAi } from "../server/ai.server.js";

/** GET /api/agent/models — key-free model list for the picker. */
export async function loader() {
  try {
    return Response.json(getAi().models());
  } catch {
    // Provider not configured yet — an empty picker is the correct UI.
    return Response.json([]);
  }
}
```

- [ ] **Step 2: `src/routes/api.agent.ts`**

No hand-rolled `ReadableStream` — the AI SDK builds the response. The old
`cancel()` dev-server trap simply cannot occur here.

```ts
import type { AgentInput } from "@smoove/editor";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { getAi } from "../server/ai.server.js";

/** POST /api/agent — AI SDK UI message stream for one turn. */
export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as AgentInput;

  try {
    const result = await getAi().stream(body, request.signal);
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
```

> **Risk, resolve at build time:** confirm `result.stream` is the property `toUIMessageStream` wants in `ai@7` (the docs use exactly this). If the result exposes it under another name, fix here — not in `setupAi`.

## Task E3: The editor frame

- [ ] **Step 1: `src/layouts/editor-layout.tsx`**

The chat rail *replaces* the studio sidebar — this is the frame `templates/editor` will copy.

```tsx
import { Editor } from "@smoove/editor";
import { Studio } from "@smoove/studio";
import { Outlet, useNavigate } from "react-router";
import registry from "../registry.js";
import { createHttpRenderBackend } from "../render-client.js";

const render = createHttpRenderBackend("/api/render");

export default function EditorLayout() {
  const navigate = useNavigate();
  return (
    <Studio registry={registry} render={render} onNavigate={(id) => navigate(`/editor?c=${id}`)}>
      <Studio.Body>
        <Editor.ChatRail endpoint="/api/agent" />
        <Outlet />
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}
```

- [ ] **Step 2: `src/routes/editor.tsx`**

```tsx
import { Studio } from "@smoove/studio";
import { ClientOnly } from "../components/client-only.js";

export default function EditorRoute() {
  return (
    <Studio.Main>
      <ClientOnly>
        {() => (
          <>
            <Studio.Stage />
            <Studio.Timeline />
          </>
        )}
      </ClientOnly>
    </Studio.Main>
  );
}
```

> Read `src/components/client-only.tsx` and match its existing children signature rather than changing it.

- [ ] **Step 3: `src/routes.ts`**

```ts
import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  layout("layouts/studio-layout.tsx", [
    index("routes/home.tsx"),
    route("c/:id", "routes/composition.tsx"),
    route("queue", "routes/queue.tsx"),
  ]),
  // The editor: its own frame, since the chat rail replaces the sidebar.
  layout("layouts/editor-layout.tsx", [route("editor", "routes/editor.tsx")]),
  // Standalone player-only page (no Studio shell).
  route("player", "routes/player.tsx"),
  // Render API (resource routes — no UI).
  route("api/render", "routes/api.render.ts"),
  route("api/render/:jobId/events", "routes/api.render.events.ts"),
  route("api/render/:jobId/download", "routes/api.render.download.ts"),
  route("api/render/:jobId/cancel", "routes/api.render.cancel.ts"),
  // Agent API (resource routes — no UI).
  route("api/agent", "routes/api.agent.ts"),
  route("api/agent/models", "routes/api.agent.models.ts"),
] satisfies RouteConfig;
```

- [ ] **Step 4: `src/layouts/studio-layout.tsx`** — add a nav item inside `<Studio.Section>`, above the Player item:

```tsx
        <Studio.NavItem
          icon="play"
          title="Editor"
          active={location.pathname === "/editor"}
          onClick={() => navigate("/editor")}
        />
```

> Pick a better `icon` from `packages/studio/src/components/icon/paths.tsx` if one fits (`IconName` is exported). `play` is a placeholder.

- [ ] **Step 5: `src/root.tsx`** — load the editor stylesheet after studio's:

```ts
import "@smoove/editor/styles.css";
```

- [ ] **Step 6: Add the dep + install**

Add `"@smoove/editor": "workspace:*"` to `packages/kitchen-sink/package.json` `dependencies`, then `pnpm install`.

---

# Part F — Verification

## Task F1: Build

- [ ] `pnpm build` → exit 0.

## Task F2: Lint

- [ ] Run:

```bash
pnpm format
pnpm exec biome check --write packages/editor/src/index.ts packages/editor/src/server/index.ts
pnpm check
```
Expected: `pnpm check` exits 0.

> If Biome fights the **vendored** `src/components/ai-elements/**` and `src/components/ui/**` (it will — upstream formatting differs), do **not** reformat them; that destroys re-syncability. Add an `includes` exclusion for those two directories to the root `biome.json` and note it in `NOTICE`.

## Task F3: No new typecheck errors

- [ ] Run:

```bash
pnpm --filter @smoove/kitchen-sink run typecheck 2>&1 | grep -E "^[a-z].*error TS" | sed 's/(.*//' | sort | uniq -c
```
Expected: matches the baseline captured in **Task A3 Step 2**. Any *new* error code is a real regression — fix it.

## Task F4: Boot + stream

- [ ] **Step 1:**

```bash
cp packages/kitchen-sink/.env.example packages/kitchen-sink/.env
# edit .env with a real provider + key (or point at a local endpoint)
pnpm dev
```
Expected: Vite serves on `http://localhost:5174`.

- [ ] **Step 2: The model list**

```bash
curl -s http://localhost:5174/api/agent/models
```
Expected: `[{"id":"…","label":"…"}]`. **Never contains an `apiKey`.**

- [ ] **Step 3: The agent pipe, including a tool call**

```bash
curl -N -X POST http://localhost:5174/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"How many compositions are in this project? Use your tools."}]}]}'
```
Expected: a UI-message-stream (SSE-framed `data:` lines) containing a `tool-listCompositions` part that transitions to an output-available state, then text chunks. This proves `setupAi` + toolkit + multi-step tool calling in one shot.
(The body shape is `UIMessage[]` — `parts`, not `text` — because `useChat` sends UIMessages.)

- [ ] **Step 4: The direct-call API (no LLM)**

```bash
pnpm --filter @smoove/kitchen-sink exec node --input-type=module -e "
import { listCompositions } from '@smoove/editor/server';
const { default: registry } = await import('./src/registry.js');
console.log(listCompositions({ registry }).length);
"
```
Expected: a count (~30). This is the load-bearing proof that toolkit functions are callable directly, outside any agent. If importing the `.ts` registry under plain node fails, exercise the same call through the dev server instead and note it — the *contract* (`listCompositions({ registry })`) is what matters.

- [ ] **Step 5: Browser**

Load `http://localhost:5174/editor`. Expected: chat rail on the left rendering AI Elements in smoove's colors (dark `bg-0` surface, accent submit button), a populated model picker in the prompt input, stage + timeline in the center. Scrub the timeline, then ask "what frame am I on?" → the agent calls `getTimeline` (rendered as a collapsible `<Tool>` card) and reports the frame. This proves the `EditorContext` snapshot round-trips through `sendMessage`'s `body`.

- [ ] **Step 6: Changeset**

```bash
pnpm changeset
```
Select `@smoove/editor` and `@smoove/studio` (the `theme.css` export), bump `minor`, summary: `Add @smoove/editor: LLM-driven composition editor (setupAi, agent toolkit, AI Elements chat rail).`

---

## Self-review notes

- **Scope:** Part A (React 19) is independent and must land first. Parts B–F are the editor.
- **Coverage:** package + `setupAi` + toolkit + direct-call functions + model picker + AI Elements chat rail (B–D); kitchen-sink editor section (E). `templates/editor` is a later phase — it can't be installed until `@smoove/editor` is published, so it must be extracted from the *proven* kitchen-sink section.
- **Deferred to Phase 2+:** `ProjectFs` and all write tools (`readFile`/`writeFile`/`editFile`/`scaffoldComposition`/`typecheck`), the smoove-video skill in the system prompt, `plan.md` + the Plan tab, selection references, media/files (AI Elements' `PromptInput` attachments are already there to hang it on), props references, export.
- **Type consistency:** `ModelMeta`, `ModelSpec`, `ModelInfo`, `SequenceInfo`, `EditorContext`, `EditorChatBody`, `AgentInput`, `AiRuntime` live once in `src/types.ts`. `EditorToolContext` lives once in `tools/context.ts`. `setupAi`, `defineModel`, `getDefaultSmooveEditorTools`, `listCompositions`, `getTimeline` are named identically in the plan, the barrel, and kitchen-sink's usage.
- **No provider abstraction.** There is no `ProviderConfig` and no `resolveModel`. The AI SDK owns model construction; `defineModel` only adds picker metadata, and derives `id`/`label` from the model when omitted. This drops four dependencies from the published package and removes a layer that could only ever lag the SDK.
- **Four flagged risks, each with a resolution step rather than a guess:** (1) the vendored components' real export names/props — read the files, conform `ChatRail` to them, never the reverse (D2); (2) `convertToModelMessages` sync-vs-async (C4); (3) `result.stream` as `toUIMessageStream`'s input (E2); (4) the real `Composition`/`Sequence` accessors behind `useEditorContext` (D1). None of them change a public contract.
- **The `--color-accent` collision is called out explicitly** (B5 Step 1): smoove's `accent` is the hero red, shadcn's `accent` is a muted hover surface. Both cannot be live. A plan that silently bridged it would have quietly greyed out every accent surface in the editor.
- **Vendoring hygiene:** Apache-2.0 requires attribution + a statement of modification (`NOTICE`, B4 Step 6), and the vendored tree is excluded from Biome so it stays diffable against upstream (F2).
