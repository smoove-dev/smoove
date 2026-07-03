# AGENTS.md

This is a smoove studio project. smoove brings Remotion-style
timeline-driven animation to Konva: a `Composition` owns the frame clock
(fps + durationInFrames), each `Sequence` is a range-gated layer, and you
animate by mutating Konva/smoove nodes inside
`sequence.register((frame) => ...)`. Every animated value must be a pure
function of the frame. Import shapes from `@smoove/core`, not `Konva.*`.

## Before writing composition code

Install and follow the `smoove-video` skill. It covers sequencing,
Flex/Block layout, interpolate-based animation, text, shapes, and media:

    npx skills add smoove-dev/smoove -s smoove-video

## Layout

- `src/compositions/<name>/composition.ts` — a composition (this is where
  animation code lives). Its sibling `index.ts` is the registry entry.
- `src/registry.ts` — the catalog the studio UI and the server renderer
  share. New compositions must be listed here.
- `src/layouts/studio-layout.tsx`, `src/routes/` — the studio shell
  (React Router). Rarely needs changes.
- `src/server/`, `src/routes/api.render.*` — the server render queue.

Docs: https://smoove.dev
