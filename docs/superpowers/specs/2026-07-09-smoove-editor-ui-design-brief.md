# SmooveEditor — UI Design Brief

**Date:** 2026-07-09
**Scope:** the *new* surfaces only. SmooveEditor is `@smoove/studio` + an agent.
Everything visual that studio already ships — the frame, Stage, Timeline,
SchemaForm, render/export dialogs, primitives, tokens — is **inherited, not
redesigned**. This brief specifies what studio does *not* already have.

---

## 0. Product context (what we're designing for)

SmooveEditor is an LLM-driven authoring surface for smoove compositions — a
local dev-server app in the same shape as studio, where a **chat agent** reads
and writes real composition source files while a **live preview updates via
Vite HMR** in the center of the screen. The user brings their own model (any
provider — Anthropic/OpenAI/Google or a local endpoint); the key stays on the
server, never in the browser. The agent writes full-power smoove TypeScript, so
the app's opinionation lives in the **workflow and UX**, not a restricted code
model.

The interaction shape the UI must serve:

- **Core loop:** the user describes a change → the agent edits `composition.ts`
  → HMR reflects it in the center preview within ~a second. Every design
  decision below serves the legibility and trust of that loop.
- **Agent-driven soft phases:** the agent moves intake (clarifying questions) →
  a written plan (`plan.md`) → build. These are agent *behaviors*, not a
  server-enforced state machine, so their UI is a status whisper plus one soft
  approval gate — never a locked stepper.
- **Four reference/feature pillars** the surfaces must expose: **canvas
  selection** (draw a box over the preview to point at elements), **media/files**
  (attach assets to reference or use in the comp), **props** (reference schema
  fields in chat), and **export** (reuses studio's dialogs). References from all
  three of the first pillars flow into the chat as attachable "chips."

## 1. Design foundation (inherited — reference only)

Build on the studio design system verbatim. Do not introduce a second visual
language.

- **Surfaces:** `--color-stage`, `--color-bg-0 … bg-3` (deepest → raised),
  `--color-line` / `--color-line-2` for hairlines.
- **Ink:** `--color-ink-1/2/3` (primary/secondary/tertiary).
- **Accent + status:** `--color-accent` (#ff5640) is the single hero; the
  editor introduces **no new brand color** — it reuses accent for the agent's
  "live/thinking" identity and `--color-accent-2` (#15cda8) sparingly for the
  selection layer (see §5). `--color-good/warn/danger` for tool outcomes.
- **Shape:** every corner routes through `--radius-ui` (10px) / `--radius-control` (7px).
- **Type:** `--font-display` (Comfortaa) for headings, `--font-sans` (Hanken
  Grotesk) for UI, `--font-mono` (JetBrains Mono) for code/diffs/paths.
- **Primitives:** compose the existing `Studio.Button/IconButton/Dialog/Tabs/
  Select/Switch/Slider/NumberField/Menu/Tooltip/Toasts/Icon`, the `DialogField`
  row, and the `.scroll` / portal conventions. New parts must feel like siblings
  of these, not imports from elsewhere.

Everything below assumes this foundation and only calls out deltas.

## 2. The frame — what changes vs. studio

Studio's body is `sidebar (256) · stage · panel (320)`. SmooveEditor keeps the
center and right, and **replaces the left sidebar with a conversation rail**:

```
┌ Header (studio) ─────────────────────────────────────────────────────────┐
├───────────────┬──────────────────────────────────────┬───────────────────┤
│  CHAT RAIL    │  CENTER  [ Preview │ Plan ]           │  RIGHT PANEL      │
│  (new)        │  Stage + SelectionOverlay (new)       │  [ Files │ Props ]│
│  ~360–400px   │  Studio.Timeline                      │  --spacing-panel  │
│               │                                        │  (Files = new)   │
├───────────────┴──────────────────────────────────────┴───────────────────┤
│  (footer / status, studio)                                                │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Left = chat rail (new).** Wider than the studio sidebar — introduce a
  `--spacing-chat` (~360–400px), resizable via the existing `PanelHandle`
  pattern. Composition navigation (the studio Library/Sidebar) folds into a
  compact switcher in the Header or the top of the rail — the left column's job
  is now conversation, not catalog.
- **Center = studio Stage/Timeline, wrapped in a Preview|Plan tab set (new).**
- **Right = studio Panel, now a two-tab set: Files (new) + Props (studio
  SchemaForm).**

Density, hairlines, and background layering match studio exactly: rail on
`--color-bg-0`, cards/rows step up to `bg-1`/`bg-2`, stage stays `--color-stage`.

## 3. Chat rail

The heart of the product. It must read as a focused authoring conversation, not
a generic chatbot.

**Regions (top → bottom):**

1. **Rail header** — active composition switcher + agent status dot (see
   Phase indicator §9). Minimal, one line.
2. **Message stream** (`.scroll`) — user and assistant turns.
3. **Composer** — pinned to the bottom: the ref-chip tray, the text input, the
   attach (media) affordance, and send/stop.

**Message turns:**

- **User turns:** right-aligned or clearly inset; `bg-2` bubble, `--radius-ui`.
  Attached reference chips render inline at the top of the bubble.
- **Assistant turns:** full-width, no bubble (reads as the app speaking, like a
  transcript). Markdown-rendered (`--font-sans`; code in `--font-mono` on
  `bg-1`). Streaming text appends live; a subtle accent caret marks the
  in-flight token position.
- **Tool-call cards** (§7) render inline between assistant text, in call order.
- **Intake questions** the agent asks render as normal assistant text, but a
  quick-reply affordance (chips/buttons) may accompany simple multiple-choice
  asks (resolution, duration) to keep intake fast.

**Empty / first-run state:** a warm, on-brand prompt ("Describe the motion —
smoove will build it") plus 3–4 example starter prompts as clickable cards, and,
if no provider is configured, a single inline call-to-action to open Provider
Settings (§8).

## 4. Reference chips

The connective tissue between the canvas/props/media and the conversation. One
consistent chip language, three sources, each visually distinguishable:

| Source | Glyph | Label example | Accent |
| --- | --- | --- | --- |
| **Selection** | crosshair/marquee | `Text "Title"` or `Rect ×3` | `--color-accent-2` edge |
| **Prop** | slider/field | `prop: titleColor` | neutral `line-2` |
| **Media** | image/film/wave | `logo.png` | neutral `line-2` |

- Chips live in the **composer tray** before send (removable, `×`), and render
  **inline in the sent user turn** (read-only) afterward.
- Compact by default (glyph + short label), `--radius-control`, `bg-3` fill.
  Hover/focus reveals a tooltip with the full descriptor (node class + rect +
  frame for selections; mime + dimensions for media; current value for props).
- Selection chips carry the frame they were captured on; if the playhead has
  since moved, show a subtle "@f123" suffix so the reference stays unambiguous.

## 5. Selection overlay (center, over the Stage)

The distinctive interaction. An absolutely-positioned layer over `Studio.Stage`.

- **Idle:** invisible; the Stage behaves normally.
- **Arming:** a toggle (IconButton in the stage toolbar, or a held modifier)
  enters "select" mode; cursor becomes crosshair, a faint `accent-2` vignette
  hints the mode is live.
- **Drawing:** click-drag paints a marquee — 1px `accent-2` stroke, `accent-2`
  soft fill at ~8% (`color-mix`), animated marching-ants (respect eased,
  smoove-y motion; disable under `prefers-reduced-motion`).
- **Hit feedback:** nodes whose `getClientRect` intersect the box highlight with
  an `accent-2` outline as you drag (live `haveIntersection`), so the user sees
  what they're about to reference before releasing.
- **Release:** the hit set becomes selection ref chip(s) in the composer;
  overlay returns to idle. A single click = 1px box = "the element here."
- **Multi-select:** additive draw (shift) accumulates chips; a small floating
  count badge ("3 elements") confirms.

`accent-2` (teal) is chosen deliberately: it separates the *selection* signal
from the *agent-live* signal (accent red), so the two never read as the same
state.

## 6. Center tabs — Preview | Plan

- **Tab set** uses `Studio.Tabs`, seated above/around the Stage without pushing
  the Timeline. Preview is the default and the resting state.
- **Preview:** the live Stage + Timeline, unchanged studio behavior + the
  selection overlay.
- **Plan tab:** renders the current `plan.md` as styled markdown (same markdown
  styling as assistant messages). Header row shows the plan title + status
  (Draft / Approved). A primary **"Approve & build"** button (studio `Button`,
  accent) sits in the tab's action bar — pressing it sends the soft go-ahead and
  flips status to Approved. If no plan exists yet, an empty state ("No plan yet —
  ask smoove to draft one").
- A subtle unread/updated indicator on the Plan tab when the agent rewrites the
  plan while the user is on Preview.

## 7. Tool-call cards & diffs

Agent actions must be legible and trustworthy — the user should always see what
the agent touched.

- **Card:** compact row on `bg-1`, `--radius-control`, a tool glyph, a
  human-readable line ("Edited `comps/intro/composition.ts`", "Ran typecheck",
  "Scaffolded `intro`"). Status affordance on the right: spinner (`.spin`) while
  running → check (`--color-good`) / cross (`--color-danger`).
- **Expandable:** file writes expand to a **diff** (mono, red/green lines on
  `bg-1`) — collapsed by default to keep the stream scannable. Path is a
  clickable `--font-mono` chip.
- **Typecheck / errors:** a failed typecheck renders diagnostics in `--color-warn`/
  `danger`; the following assistant turn (the repair) visually links to it.
- Keep cards quiet. They are provenance, not the main content — muted until
  hovered/expanded.

## 8. Provider settings

- Opened from the rail header or the first-run CTA; a studio `Dialog` built from
  `DialogField` rows (matches render/export dialogs).
- Fields: provider `Select` (Anthropic / OpenAI / Google / Local · OpenAI-compatible),
  model, API key (masked; shows only "configured"), and base URL for the local
  option. A "Test connection" action gives `good`/`danger` feedback.
- Reinforce, quietly, that the key stays local/server-side.

## 9. Phase indicator (soft)

The intake → plan → build phases are agent behaviors, so their UI is a **status
whisper, not a stepper**:

- A single status pill / dot in the rail header: `Idle` · `Asking…` ·
  `Planning…` · `Building…` · `Error`. Accent-tinted while live (with the
  `.spin`/pulse), neutral at rest.
- No hard progress bar or locked steps (there is no state machine). The Plan
  tab's Draft→Approved status carries the one meaningful gate.

## 10. Files tab (right panel)

- List of project media as rows (`bg-1`, thumbnail/glyph, filename in mono,
  a **role badge**: `reference` vs `use`, muted).
- Header actions: **Attach** (upload) and a filter. Row actions (menu):
  Reference in chat (drops a media chip in the composer), Replace, Reveal.
- Upload affordance also lives in the composer (drag-drop onto the rail or the
  attach button). On attach with unclear intent, the *agent* asks for context in
  chat — the UI just needs a clear pending/"needs context" state on the new row.

## 11. Props reference affordance

- The studio `SchemaForm` is unchanged except each field row gains a small,
  hover-revealed **"reference"** IconButton that drops a `prop:<name>` chip into
  the composer. No layout shift at rest — it appears on row hover/focus, like a
  secondary action.

## 12. Motion & interaction principles

On-brand: **effortless, playful, sharp.** Motion is a feature here, not decoration.

- Streaming text, tool-card status transitions, chip add/remove, tab changes, and
  the marquee all use **eased, smoove-y** transitions — nothing linear, nothing
  abrupt. Short (120–200ms) and confident.
- Everything degrades cleanly under `prefers-reduced-motion` (no marching ants,
  no pulses — swap for static states).
- Latency honesty: every agent action shows an immediate optimistic state
  (spinner/skeleton) so the ~1s HMR round-trip never feels dead.

## 13. Voice & microcopy

Follow the smoove brand voice (and the `smoove-writing` skill for any shipped
copy): plain, a little playful, active verbs, motion metaphor when it lands
("Describe the motion", "smoove is building…"). Never compare to other tools.
Errors are calm and actionable, never blaming the user. Keep the wink in the
empty states and starters, not in error text or diffs.

## 14. Accessibility & density

- Match studio density and `.scroll` behavior; thin scrollbars, hairline
  separators, generous-but-tight spacing.
- Full keyboard path: focus the composer, send, stop, switch tabs, toggle select
  mode, approve plan — all reachable without the mouse (extend `useShortcuts`).
- Contrast: keep `accent`/`accent-2` for state edges and glyphs, not for large
  text on dark surfaces; body copy stays `ink-1/2`.
- Selection mode, streaming, and phase changes announce via live regions for SR
  users.

## 15. Explicitly out of scope

- Redesigning the Header, Timeline, Stage internals, SchemaForm controls, render
  or export dialogs, or any studio primitive. Reuse as-is.
- A light theme, a second accent system, or any new font. One system, inherited.
- Icon set expansion beyond what the new surfaces genuinely need (crosshair/
  marquee, attach, diff/tool glyphs) — draw them in the existing icon style.

## 16. Deliverables (for the designer)

1. Frame layout with the chat rail + resized columns (light spec of the new
   `--spacing-chat`).
2. Chat rail states: empty/first-run, mid-conversation, streaming, intake
   question with quick-replies.
3. Reference chip set (selection / prop / media) — resting, hover, in-composer,
   in-sent-turn.
4. Selection overlay states: armed, drawing with live hits, released.
5. Center Preview|Plan tabs, incl. the Plan tab with Draft and Approved states.
6. Tool-call card set: running, success, error, expanded diff.
7. Provider settings dialog.
8. Files tab rows (role badges, needs-context state) + Props reference
   affordance on a SchemaForm row.
9. The phase status pill in its five states.

All as extensions of the existing studio component sheet — same tokens, same
primitives, same feel.
