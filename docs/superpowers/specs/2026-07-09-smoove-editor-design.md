# SmooveEditor — Design Spec

**Status:** Draft for review
**Date:** 2026-07-09
**Package (new):** `@smoove/editor`
**Depends on:** `@smoove/studio`, `@smoove/core`, `@smoove/player`, `@smoove/renderer`, the AI SDK (`ai` + provider packages)

---

## 1. Summary

SmooveEditor is an LLM-driven authoring surface for smoove compositions. It is
a **local dev-server app** — the same shape as `@smoove/studio` + `kitchen-sink`
— where a chat agent, connected to a smoove-specific tool belt, reads and writes
real composition source files in the user's project while a live preview
(Vite HMR) updates in the center of the screen.

The mental model is deliberately **studio-plus-agent**: reuse the studio shell
(Stage, Timeline, SchemaForm props panel, render/export dialogs) for everything
visual, and add a chat panel, a plan view, a selection overlay, and a
server-side agent runtime around it. Where studio is an unopinionated UI kit,
`@smoove/editor` is **more opinionated**: it ships a curated agent workflow and
a constrained UX, but the *code* the agent writes is full-power smoove
TypeScript, not a restricted DSL.

Users bring their own model — any provider the AI SDK supports (Anthropic,
OpenAI, Google, or a local/OpenAI-compatible endpoint). The key lives in server
config, never in the browser.

## 2. Goals

- **Chat → edit → live preview** as the core loop: describe a change, the agent
  edits `composition.ts`, HMR reflects it in the center preview within a second.
- **Reuse the studio parts.** The editor's center and right regions are studio
  components; the editor only *adds* the chat, plan, selection, and agent layers.
- **Composable parts + a template**, mirroring the studio/kitchen-sink split.
  `@smoove/editor` exposes React parts and a server toolkit; a template app wires
  them. The consumer composes the layout.
- **BYO model.** Provider + key configured locally; no vendor lock-in; local
  models work.
- **Agent-driven soft-phase workflow:** intake questions → written plan
  (`plan.md`) → build. Phases are agent behaviors surfaced in the UI, not a
  server state machine.
- **Four v1 feature pillars** (all in scope for the first release, sequenced as
  milestones): canvas selection references, media/files, props references,
  export.

## 3. Non-goals

- **No browser-side model execution or in-browser TS eval.** The runtime is a
  local Node server; code runs through Vite/tsc like any smoove project.
- **No declarative composition model / structured authoring API.** The agent
  writes freeform smoove TS. "Opinionated" applies to the workflow and UX, not
  the code representation.
- **No hard phase state machine in v1.** Approval is a soft affordance. The
  context/tool layer is architected so explicit phase gating *could* be layered
  on later, but that is out of scope now.
- **No multi-user / cloud hosting / auth.** Single local user, single project.
- **No new rendering engine.** Export and render reuse `@smoove/renderer` and the
  studio render-queue server kit.

## 4. Architecture

```
┌─────────────────────────── Browser (React app) ───────────────────────────┐
│  @smoove/editor parts, composed on top of the @smoove/studio shell         │
│                                                                            │
│  ┌── Chat panel ──┐  ┌──── Center: Studio.Stage + Timeline ────┐  ┌ Right ┐│
│  │ messages       │  │  Tabs: [ Preview | Plan ]               │  │ Files ││
│  │ streaming      │  │  Preview = live Stage / <smoove-player> │  │ Props ││
│  │ ref chips      │  │  Plan    = rendered plan.md             │  │       ││
│  │ provider setup │  │  Selection overlay (draw box)           │  │       ││
│  └────────────────┘  └─────────────────────────────────────────┘  └───────┘│
└──────────────┬───────────────────────────────────────────┬─────────────────┘
               │ SSE (agent stream: tokens, tool events)    │ HMR (Vite)
┌──────────────┴───────────────────────────────────────────┴─────────────────┐
│  Local dev server (Node, inside the template app)                          │
│                                                                            │
│  Agent runtime  (@smoove/editor/server)                                    │
│   • AI-SDK streamText loop, multi-step tool calling, BYO provider          │
│   • system prompt = smoove-video skill + editor conventions + live context │
│   • Tool belt: fs · registry/scaffold · timeline · selection · media ·     │
│                typecheck · export                                          │
│                                                                            │
│  Reuses: registry loader + update()/onChange, @smoove/renderer,            │
│          studio render-queue kit, mediaSrc asset mapping                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 One turn, end to end

1. User submits a message, optionally carrying **reference chips**: selected
   canvas nodes, props, and/or attached media.
2. Browser `POST`s to `/api/agent` (message + references + the current editor
   context snapshot: composition id, current frame, viewport).
3. Server assembles the **system prompt**: the `smoove-video` skill body +
   editor conventions + a rendered **live-context block** (current frame, fps,
   active sequences, resolved selection descriptors, project file tree).
4. The AI-SDK `streamText` multi-step loop runs. Tool calls that write files
   mutate real `composition.ts` on disk.
5. Vite HMR picks up the file change; the registry's `update(id, …)` +
   `onChange` swap the composition and the center preview re-renders.
6. Tokens and structured tool events stream back over SSE and render in the chat
   (assistant text, tool-call cards, diffs, errors).

### 4.2 Key seams

- **The agent never talks to the browser directly.** It reads/writes the project
  and reports over SSE. This keeps the runtime testable headless.
- **The browser never runs the model.** The key sits in server config
  (`.env`/settings file); BYO-key stays off the client.
- **HMR is the preview transport.** File edit → Vite → `Registry.update` →
  re-render. The editor does not push preview state over the wire; it edits code
  and lets the existing dev-loop reflect it. (`Registry.update`/`onChange`
  already exist for exactly this dev hot-reload case.)
- **Selection is the one bidirectional bridge.** The browser computes intersecting
  nodes (`Konva.Util.haveIntersection`); resolving those to *editable source* is a
  server tool (§7).

## 5. Package & repo layout

Mirror the studio/kitchen-sink convention.

```
packages/editor              @smoove/editor
  src/
    index.ts                 public barrel (React parts + hooks)
    server/
      index.ts               server barrel (Node-only; NO HTTP — host wires transport)
      agent.ts               createAgentRuntime(): AI-SDK loop + streaming contract
      tools/                 one module per tool group (fs, registry, timeline, selection, media, typecheck, export)
      project.ts             ProjectFs adapter (scoped, safe path resolution)
      providers.ts           provider factory (anthropic | openai | google | openai-compatible/local)
      system-prompt.ts       skill body + conventions + live-context renderer
      export.ts              comp/sequence → js/ts + asset zip
    components/
      chat/                  ChatPanel, MessageList, Composer, RefChip, ToolCallCard
      plan/                  PlanTab (renders plan.md)
      selection/            SelectionOverlay (draw box → haveIntersection → refs)
      files/                 FilesTab (attach/list/replace media)
      provider/             ProviderSettings
    hooks/
      use-agent.ts           SSE client: send message, stream events, cancel
      use-selection.ts       overlay geometry → intersecting nodes → ref payload
      use-references.ts      pending ref chips (selection/props/media)

templates/editor             standalone starter (or packages/editor-app dev harness)
  — React Router SSR app that composes <Studio> + @smoove/editor parts,
    wires /api/agent (SSE) + /api/render*, holds a real project dir of compositions.
```

Reasoning for a **new package** (vs. folding into studio, vs. a monolith app):
studio is intentionally UI-only, isomorphic, peerDep-light, with no server;
an AI-SDK server agent does not belong there. A monolith app would drop the
reusable-parts requirement. `@smoove/editor` keeps the studio boundary intact
and satisfies "expose parts + template."

**Changesets/workspace:** new publishable package → add to the `fixed` group in
`.changeset/config.json`; the template is not in the pnpm workspace (depends on
published versions), like the existing `templates/*`.

## 6. Agent runtime

### 6.1 Providers (BYO model)

`providers.ts` maps a small config to an AI-SDK model:

```ts
type ProviderConfig =
  | { kind: "anthropic";        model: string; apiKey: string }
  | { kind: "openai";           model: string; apiKey: string }
  | { kind: "google";           model: string; apiKey: string }
  | { kind: "openai-compatible"; model: string; baseURL: string; apiKey?: string }; // local / self-hosted
```

Config is read from a local settings file / `.env` in the template. The
`ProviderSettings` part is a thin UI over that file (never sends the key to the
browser beyond a masked "configured" indicator).

**Local / self-hosted models (first-class target).** The `openai-compatible`
kind is the single path for any model served behind an OpenAI-style
`/v1/chat/completions` endpoint — directly, or via Ollama / vLLM / LM Studio /
SGLang / llama.cpp. The user sets `baseURL` (e.g. `http://localhost:11434/v1`)
and `model`; `apiKey` is optional. Explicitly supported this way — and used as
validation targets — are agentic coding models such as **Ornith 1.0** and
**Qwen3-Coder**. No provider code is added per model; they all resolve through
this one kind.

Because the runtime is a **multi-step tool-calling loop**, a usable model
(hosted or local) must meet two requirements, independent of transport:

1. **Reliable tool/function calling** — well-formed tool args and multi-step
   chaining. The zod-validated tool boundary + the typecheck-repair loop (§12)
   absorb occasional misfires, but a model that can't tool-call will stall.
2. **Adequate context window** — enough budget for the system prompt (skill body
   + editor conventions) + the live-context block + file reads. On short-context
   local builds this is the binding constraint on large projects; see the
   file-tree summarization note in §16.

Models that fail (1) are surfaced in `ProviderSettings` via the "Test
connection" check (a probe tool call), so an incompatible endpoint fails loudly
at setup rather than mid-build.

### 6.2 The loop

`createAgentRuntime(project, registry, config)` returns a runtime whose
`run(message, refs, context)` yields an async stream of events. Internally it is
an AI-SDK `streamText` call with `maxSteps` (multi-step tool calling), the tool
belt (§6.4), and the assembled system prompt (§6.3). Following the studio server
convention, this module is **transport-agnostic** — it yields events; the
template maps them onto SSE.

Event stream (discriminated union):

```ts
type AgentEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | { type: "tool-result"; id: string; result: unknown }   // includes diffs for fs writes
  | { type: "file-changed"; path: string; kind: "create"|"edit"|"delete" }
  | { type: "phase"; phase: "intake"|"plan"|"build" }        // inferred/annotated, soft
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "done" };
```

### 6.3 System prompt & live context

Assembled per turn from three parts:

1. **Skill body** — the `skills/smoove-video/SKILL.md` content (+ its `rules/`),
   read at startup. This is the single source of truth for *how to author* a
   composition; the editor does not re-teach the API.
2. **Editor conventions** — the workflow contract: ask clarifying questions
   before building; write/update `plan.md` and wait for a go-ahead before large
   builds; always give created Konva nodes stable `name`s (this powers selection
   §7); scaffold new comps into their own directory and wire the registry;
   prefer small edits; after edits, expect typecheck feedback and fix errors.
3. **Live-context block** — rendered fresh each turn: active composition id,
   `durationInFrames`/`fps`, **current frame**, list of sequences with their
   `[from, from+duration)` ranges, resolved **selection descriptors**, current
   **props** values + schema, attached **media** manifest, and a compact project
   file tree.

Phases are **soft**: the conventions instruct the agent to move
intake → plan → build; a lightweight classifier annotates each turn with a
`phase` event for the UI (Plan tab highlight, "approve" affordance). No server
gate blocks tool use.

### 6.4 Tool belt

All tools are project-scoped through the `ProjectFs` adapter (§8), which
resolves and validates every path against the project root (no escapes).

| Tool | Purpose |
| --- | --- |
| `listFiles(glob?)` | Project file tree / targeted listing. |
| `readFile(path)` | Read source. |
| `writeFile(path, content)` | Create/overwrite; emits a `file-changed` + diff. |
| `editFile(path, edits)` | Anchored string edits (studio-style), preferred over full rewrite. |
| `scaffoldComposition({ name })` | Create `comps/<name>/` with `composition.ts` (from a default template) + `index.ts`, and wire it into the registry entry list. Returns the new id. |
| `listCompositions()` | Registry catalog (ids + metadata). |
| `getTimeline(id?)` | fps, durationInFrames, current frame, sequences with ranges. |
| `resolveSelection(refIds)` | Turn selection reference ids into source-anchored node descriptors (§7). |
| `listMedia()` / `describeMedia(id)` | Project asset manifest + metadata. |
| `typecheck(path?)` | Run project `tsc --noEmit` (or read the Vite/HMR error overlay state); returns diagnostics for the feedback loop. |
| `exportComposition({ id, sequence? })` | Produce a standalone js/ts + asset zip (§10). |

Writes go straight to disk; the guardrail is the **typecheck feedback loop**:
after a batch of edits the agent is expected to call `typecheck` (or the runtime
auto-invokes it) and repair diagnostics before declaring done. HMR surfacing of
runtime errors is reported back via a `file-changed`→error path.

## 7. Selection-to-source bridge (feature pillar)

The distinctive UX: draw a box on the preview, reference the elements inside it
in chat ("make *this* text bigger"). The hard part is mapping a Konva scene-graph
node back to *editable source* the freeform agent can find.

**Browser side (`use-selection.ts` + `SelectionOverlay`):**

- The overlay captures a drag rectangle over the Stage.
- For each Sequence layer (recall: each Sequence is its own Konva layer/canvas —
  sample all of them, per the demo-canvas-per-layer learning), walk candidate
  nodes and test `Konva.Util.haveIntersection(box, node.getClientRect())`.
- Produce a **selection reference** per hit: `{ seqId, nodeName, nodeClass,
  attrs snapshot, clientRect, frame }`. A single click is the degenerate 1px box.
- These become **ref chips** in the composer.

**Server side (`resolveSelection`):**

- Given the reference's `seqId` + `nodeName`, the tool greps the composition
  source for that `name` and returns a **source-anchored descriptor**: the file,
  the construction site (line), the current attrs, and the containing sequence.
- This works precisely *because* the editor conventions require the agent to
  give every created node a stable `name`. When a node lacks a name (older/edited
  code), the descriptor degrades to "unnamed node of class X at rect R on frame
  F, in sequence S" and the agent locates it heuristically (by class + position +
  the sequence's code).

**Why not node ids only:** freeform code has no guaranteed id registry. Names are
authored, greppable, and stable across HMR. The convention + graceful degradation
is the design.

## 8. ProjectFs adapter

A single choke point for all filesystem access from tools.

- Constructed with the project root; every tool path is resolved with
  `path.resolve` and **must** remain within root (reject traversal).
- Write operations are logged and emit diffs (for the chat tool-result cards and
  an undo trail — see §11).
- Knows the project's structure conventions: where `comps/` live, where the
  registry file is, where `assets/` live. `scaffoldComposition` and the registry
  wiring use these.

## 9. Media / files (feature pillar)

- **Attach:** the composer and `FilesTab` accept uploads. Files are written to
  the project's `assets/` dir via `ProjectFs`; a manifest entry records id,
  filename, mime, dimensions/duration, and a **role** (`reference` vs `use`).
- **Context extraction:** on attach, if the role/intent isn't clear from the
  message, the agent asks (per the flow: "each media should have context; if it
  can't be extracted, ask"). Role + description land in the media manifest, which
  is part of the live-context block.
- **Use in comp:** referenced media resolve through the existing **mediaSrc**
  mapping (Vite asset URL → fs path) so media compositions render server-side too
  (reuses the documented helper).
- **Replace/reference:** `FilesTab` supports replacing an asset (same id, new
  bytes) and dropping a reference chip into chat.

## 10. Export (feature pillar)

- **Whole composition:** bundle `comps/<name>/` source into a standalone
  `js`/`ts` file (user picks) plus, if it has local assets, a zip containing the
  file + assets. Because everything is already on disk, this is a
  packaging/serialization step, not a codegen step.
- **Single sequence:** the user selects a region on the timeline; export slices
  that sequence's source into a standalone module. (v1 may scope this to
  whole-composition export first if sequence-slicing proves fiddly — flagged in
  milestones.)
- **TS→JS:** for the `js` option, strip types with the project's existing build
  toolchain (esbuild/tsc) rather than hand-rolling.
- Renders (mp4/still) continue to go through the studio render-queue kit +
  `@smoove/renderer`; export here means *source*, not video.

## 11. UI composition

`@smoove/editor` exposes parts; the template composes them inside the studio
compound. Illustrative:

```tsx
<Studio registry={registry} render={render}>
  <Editor.ChatPanel />          {/* left: messages, composer, ref chips, provider status */}
  <Studio.Main>
    <Editor.CenterTabs>         {/* Preview | Plan */}
      <Studio.Stage />          {/* + <Editor.SelectionOverlay /> */}
      <Editor.PlanTab />
    </Editor.CenterTabs>
    <Studio.Timeline />
  </Studio.Main>
  <Studio.Panel>               {/* right */}
    <Editor.FilesTab />
    <Studio.SchemaForm />       {/* props — with Editor ref affordance */}
  </Studio.Panel>
  <Toasts />
</Studio>
```

- **ChatPanel:** streaming messages, tool-call cards (with diffs), the composer,
  and the pending ref-chip tray. Talks to the server via `use-agent` (SSE).
- **Ref chips:** produced by selection, props ("reference this prop"), and media.
  A chip is a compact structured payload attached to the next message.
- **PlanTab:** renders the current `plan.md`; an "Approve / build it" button
  sends a canned go-ahead message (the soft gate).
- **Props references:** the SchemaForm panel gains a "reference in chat"
  affordance per field so the user can say "make this a dynamic prop" with the
  field already attached.
- **Undo trail:** file writes are diff-logged; a minimal "revert last change"
  restores the pre-edit file content (v1 = last-write undo, not full history).

## 12. Error handling & guardrails

- **Typecheck feedback loop:** the primary correctness guardrail. Edits →
  `typecheck` → agent repairs diagnostics. The runtime can enforce a
  "typecheck before done" convention.
- **HMR/runtime errors:** Vite overlay / runtime throw is captured and surfaced
  to chat as a recoverable error the agent can act on.
- **Path safety:** ProjectFs rejects any path outside the project root.
- **Provider/key errors:** surfaced as `error` events with actionable text
  (missing key, bad model id, rate limit); never crash the stream.
- **Cancellation:** `use-agent` can abort an in-flight run (AbortSignal through
  to `streamText`); partial edits remain on disk with the undo trail available.
- **Malformed tool args:** validated at the tool boundary (zod schemas); invalid
  calls return a structured tool error the model can retry against.

## 13. Security considerations

- The agent has **real filesystem write access** scoped to one project root. This
  is inherent to a local dev-server design and is the same trust level as any
  local coding tool; documented plainly. ProjectFs path-scoping is the boundary.
- The agent writes **arbitrary TS that the dev server executes**. This is
  expected (it's how smoove projects run) but must be stated: SmooveEditor is a
  local authoring tool, not a sandbox for untrusted models.
- **Keys** live server-side only. The browser sees a masked "configured" status.

## 14. Testing strategy

Per repo convention (Vitest per-package, only where logic warrants):

- **ProjectFs:** path-scoping (traversal rejection), scaffold layout, registry
  wiring, diff/undo. High value, pure logic → unit tests.
- **Tool belt:** each tool against a temp project fixture (real fs in a tmp dir).
- **Selection resolution:** given a fixture composition + a node name, does
  `resolveSelection` return the right source anchor? Incl. the unnamed-node
  degradation path.
- **System-prompt assembly:** snapshot the live-context renderer for a known
  composition/frame/selection.
- **Agent loop:** exercise with a stub/mock provider (deterministic tool-call
  script) to assert the event stream and the typecheck-repair loop — no real
  model calls in tests.
- **Export:** unit-test the packaging (source + assets → zip; TS→JS strip).

Not tested preemptively: the streaming UI parts (manual/preview-tool verified),
real-provider behavior.

## 15. Milestones

Each milestone leaves a working vertical slice.

- **M0 — Package + template skeleton.** `@smoove/editor` scaffold, `templates/editor`
  composing `<Studio>` + empty editor regions, dev server with `/api/agent`
  stub. Changesets/workspace wiring.
- **M1 — Core loop (the heart).** ProjectFs, provider factory, agent runtime with
  fs + registry + timeline + typecheck tools, ChatPanel + `use-agent` SSE,
  system prompt from the skill, live preview via HMR. *Deliverable: describe a
  change, watch the preview update.*
- **M2 — Scaffold + soft-phase workflow.** `scaffoldComposition`, `plan.md`
  convention, PlanTab + approve affordance, intake-questions behavior.
- **M3 — Selection references.** SelectionOverlay + `haveIntersection`, ref chips,
  `resolveSelection` server tool, node-naming convention in the system prompt.
- **M4 — Media / files.** Upload → assets + manifest, FilesTab, role/context
  capture, mediaSrc-backed use in comps.
- **M5 — Props references.** SchemaForm "reference in chat" affordance + wiring
  into the ref-chip system.
- **M6 — Export.** Whole-composition js/ts + asset zip; then single-sequence
  export (flagged as the riskier half — may slip if slicing is fiddly).

M0–M1 are the foundation everything depends on. M3–M6 are independent of each
other and can be reordered.

## 16. Open questions / future

- **Single-sequence export slicing** — how cleanly can one Sequence's source be
  lifted out of a multi-sequence file? May need a lightweight per-sequence file
  convention to make it deterministic. (Deferred; whole-comp export is the safe
  v1 floor.)
- **Explicit phase gating** — the soft workflow is v1; a real Intake/Plan/Build
  state machine with tool-gating is a possible later hardening. The context/tool
  layer is designed not to preclude it.
- **Undo depth** — v1 is last-write revert; full history/checkpointing is future.
- **Multi-composition project navigation** — the app manages a registry of many
  comps; the library/nav UX beyond studio's existing sidebar is TBD if needed.
- **Agent cost/context budgeting** — long build sessions on large projects;
  file-tree summarization vs. full listings in the live-context block.
```
