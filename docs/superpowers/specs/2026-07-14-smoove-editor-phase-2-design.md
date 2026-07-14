# SmooveEditor Phase 2 (Authoring) — Design

**Status:** approved 2026-07-14. Implementation plan:
`docs/superpowers/plans/2026-07-14-smoove-editor-phase-2.md`.

## The goal

Phase 1 gave `@smoove/editor` a chat rail, a BYO-model `setupAi()`, and a
read-only toolkit (`listCompositions`, `getTimeline`). It can *inspect* a
project. It cannot *change* one.

Phase 2 makes the editor **author** compositions. The driving use case — the
prompt Phase 1 provably cannot fulfill:

> "Create a new composition: IG-story resolution (1080×1920), 30s at 30fps.
> Fade in to a configurable background color, then a big two-word headline
> (e.g. 'Good Job' / 'You Rock') centered, each word on its own centered line,
> animating in naturally and smoothly. At the end, everything fades out to
> black."

Fulfilling it requires four things Phase 1 lacks: a real filesystem the agent
can write to, write tools, enough smoove knowledge in the system prompt to
write idiomatic code, and a composition list of its own that a newly written
file can actually appear in.

## The problem Phase 1 left behind

**In Phase 1 the editor and the studio share one registry.** `ai.server.ts`,
`editor-layout.tsx`, and `editor.tsx` all import kitchen-sink's demo
`registry.ts` — the same static, bundled catalog of ~48 demo compositions that
powers `/` and `/c/:id`.

That is the #1 thing to fix, for two reasons:

1. **Semantics.** The demo registry is the *studio's* fixture catalog. A user's
   authored work is not a demo. The agent writing into the demo registry would
   be writing into the reference app's source tree.
2. **Mechanics.** A statically-imported, bundled registry is a compile-time
   artifact. Nothing the agent writes to disk at runtime can ever appear in it
   within the same server process. The list is frozen at import.

So Phase 2 introduces a **project**: a real directory on disk that the agent
reads and writes, and which is the sole source of the *editor's* composition
list — separate from the demo registry, which stays exactly as it is.

## Composition-on-disk shape

Each composition in the project is a directory of two files:

```
<root>/<id>/
  meta.json        catalog row: { id, title?, group?, description?, tags?,
                                  width, height, fps, durationInFrames }
  composition.ts   default-exports a Composition (the animation code)
```

The demo registry's convention is an executable `index.ts` that default-exports
a `RegistryEntry`. The project **deliberately does not follow it.** A
machine-managed catalog wants to be *declarative*: `meta.json` decouples
*listing* a composition from *executing TypeScript*. That buys three things:

- `ProjectFs.list()` is a JSON read — no bundler, no transpiler, no module
  evaluation. It is a plain Node call, so Vitest exercises it directly.
- The browser registry can glob `meta.json` **eagerly** (cheap catalog rows)
  while lazy-importing `composition.ts` (the expensive part), which is exactly
  the split `RegistryEntry` already models.
- The agent can rewrite a composition's duration or title without us having to
  parse and re-emit a TypeScript module.

## Two sources of truth, one directory

This is the core of the design. The agent and the browser learn about
compositions by different mechanisms, because they have different constraints —
but both read the same directory, so they agree.

| | Agent (server) | Browser (Studio) |
| --- | --- | --- |
| Source | `ProjectFs.list()` — reads disk on every call | Vite `import.meta.glob` registry |
| Refresh | Immediate; no cache | Vite watcher invalidates the glob → module reload |
| Why | A comp scaffolded mid-turn must be visible to the *next tool call in the same turn* | Only Vite can transpile and serve a `.ts` the browser must `import()` |

**The agent cannot use an in-memory registry.** `defineRegistry` captures its
entries array at construction, and `ai.server.ts` memoizes the `setupAi`
runtime. A composition the agent scaffolds at 10:00:01 would be invisible to
its own `listCompositions` call at 10:00:02. Reading disk per call is what
makes the author→verify loop work inside a single turn.

**The browser cannot use `ProjectFs`.** It needs a *module*, not bytes;
`import.meta.glob` is a Vite feature and must live in the app, not in the
published package.

**Consequence:** `registry` leaves `setupAi()` and `EditorToolContext`
entirely, replaced by `project: ProjectFs`. `listCompositions` is reimplemented
against `ProjectFs.list()`. `getTimeline` is untouched — it reads the per-turn
browser snapshot, which remains the only thing that knows the playhead. This is
a breaking change to the Phase 1 API, which is free: Phase 1 is unreleased and
uncommitted.

## `ProjectFs`

A plain Node class in `@smoove/editor/server`, parameterized by a root
directory. No React, no Vite, no HTTP — so it is directly unit-testable.

- `list()` → catalog rows, read from every `*/meta.json`.
- `read(relPath)` / `write(relPath, content)` / `edit(relPath, oldStr, newStr)`
  — `edit` requires a **unique** match and errors on zero or multiple hits,
  mirroring the semantics of the Edit tool the model already knows.
- `scaffold(spec)` → writes `<id>/meta.json` plus a **minimal-but-valid**
  `composition.ts`: correct dimensions, fps and duration, one empty `main`
  Sequence, a black background. It typechecks and renders on day one. The agent
  then `edit`s the animation into it. Scaffold is deterministic plumbing; the
  *creative* part is the model's job, guided by the skill in the system prompt.
  Rejects an id that already exists.
- `typecheck()` → spawns `tsc --noEmit -p <root>/tsconfig.json` and parses
  diagnostics into `{ file, line, col, code, message }[]`.

**Path jailing is a first-class requirement, not a nicety.** Every path-taking
method resolves against the root and rejects `..` traversal and absolute paths
that escape it. An LLM will eventually emit `../../../etc/passwd`, whether
through malice, a prompt injection in a file it read, or plain confusion. This
gets a dedicated unit test.

**The root is a gitignored scratch directory** (`packages/kitchen-sink/editor-project/`).
It is a sibling of `src/` — inside the Vite root, so it is globbable and
watched, but outside the app's `tsconfig` include, so scratch compositions
never break the app's build. `ProjectFs` `mkdir -p`s the root and writes the
project `tsconfig.json` on construction, so a fresh clone, a fresh Vitest temp
dir, and a fresh dev boot all behave identically.

The project therefore **starts empty**. The studio store already tolerates this
(`entries[0]?.id ?? ""`), but the editor route needs an explicit empty state —
"no compositions yet, describe one" — rather than a silently blank stage.

## Tools

Every tool follows the Phase 1 pattern exactly: **the logic is a plain exported
function; `getDefaultSmooveEditorTools(ctx)` only wraps it as an AI SDK
`tool()`.** The toolkit stays annotated `: ToolSet` (Phase 1 gotcha: without it
tsc emits TS2883, leaking unnameable `@ai-sdk` internals into the `.d.ts`).

| Tool | Phase | Notes |
| --- | --- | --- |
| `listCompositions` | 1, **rewritten** | Now reads `ProjectFs.list()`, not a registry |
| `getTimeline` | 1, unchanged | Browser's per-turn snapshot |
| `readFile` | **2** | Path-jailed |
| `writeFile` | **2** | Path-jailed |
| `editFile` | **2** | Unique-match |
| `scaffoldComposition` | **2** | The one high-level op |
| `typecheck` | **2** | The agent's self-correction signal |

`typecheck` is what closes the loop. Without it the agent writes code and hopes.
With it, it writes, checks, reads the diagnostics, and fixes — which is the
whole reason to prefer a real `tsc` run over a fast esbuild transform that only
catches syntax.

## System prompt

`src/server/system-prompt.ts` exports `smooveVideoSystemPrompt`: a distilled
version of the `smoove-video` skill, bundled **into the package** as a string
constant. A published `@smoove/editor` must teach a model to write smoove
without the consumer having the repo's `skills/` directory — the package is the
product, and "LLM-authorable" is the brand pillar it exists to prove.

It carries the mental model (imperative, per-frame, a pure function of `frame`),
the `interpolate`/`Easing` vocabulary, Flex/Block layout, `Text` (extends
`Konva.Group` — `setText()`, not `.text()`), and the two rules that most often
produce broken output: **never animate a Flex/Block child's `x`/`y`/`width`/
`height`** (the layout pass overwrites them after updaters run), and **never
`shadowBlur` in an animated scene**. Plus the tool loop: scaffold → edit →
typecheck → iterate until clean.

Bundling accepts a small drift risk against `skills/smoove-video/SKILL.md`. The
alternative — reading the skill off disk at runtime — is fresher but couples the
package to this repo's layout and breaks for every external consumer.

## kitchen-sink wiring

- **`src/editor-registry.ts`** (new) — builds the editor's registry from
  `import.meta.glob` over `../editor-project/*/meta.json` (eager) and
  `*/composition.ts` (lazy). Strictly separate from `registry.ts`, which is
  untouched and still owns `/` and `/c/:id`.
- **`src/server/ai.server.ts`** — constructs `ProjectFs(editorRoot)` and passes
  `project` to `setupAi`, replacing `registry`.
- **`src/layouts/editor-layout.tsx`, `src/routes/editor.tsx`** — swap the demo
  registry for the editor registry; add the empty state.

When the agent writes a new composition directory, Vite's watcher sees a file
matching the glob and reloads the module. That reload is a full page reload
(glob membership changes are not hot-swappable), which **loses in-memory chat
history**. That is an accepted Phase 2 wrinkle, called out rather than hidden;
persisting the conversation is a later phase.

## Testing

Vitest arrives now — Phase 1 deliberately skipped it because it had almost no
branchable logic, and AGENTS.md says not to scaffold tests preemptively.
`ProjectFs` and the write tools are the opposite: pure, branchy, Node-only
logic with real failure modes. Tests live in `@smoove/editor` and cover
`list`/`read`/`write`/`edit`/`scaffold` round-trips, the unique-match and
already-exists error paths, **path-jail escapes**, and `typecheck` against both
a clean and a deliberately broken fixture in temp directories.

## Out of scope

- **Server-side render of project compositions.** `/api/render` resolves ids
  through the *demo* registry (`server/resolve.ts`); a project id will not
  resolve. Phase 2 is the author→preview→typecheck loop; the editor's render
  affordance degrades rather than pretending to work.
- `templates/editor`, conversation persistence, selection/props references,
  media attachments, export — as Phase 1 already deferred.

## Verification

End-to-end against the local Ollama endpoint (`ornith:9b`,
`http://localhost:11434/v1`), driven with the use case at the top of this
document. **The gate is that the loop works** — the agent scaffolds, writes,
typechecks clean, and the composition registers and loads at `/editor`, with
`getTimeline` round-tripping the browser's playhead. The *aesthetic quality* of
a 9-billion-parameter model's animation is not the gate; the authoring pipeline
is.

This also verifies the end-of-Phase-1 `getTimeline` fix in the browser for the
first time: `routes/editor.tsx` selecting a composition via `?c=` (falling back
to the first entry) and calling `store.syncSelected(id)` — written in Phase 1
but never confirmed live, because the browser check was blocked on a
disconnected extension.
