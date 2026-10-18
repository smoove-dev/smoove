# AGENTS.md

This is a smoove studio project. smoove is a timeline-driven
animation engine built on top of Konva: a `Composition` owns the frame clock
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
- `src/compositions/<name>/composition.test.ts` — headless tests for a
  composition (vitest + `@smoove/core/testing`); `npm test` runs them all.

## Verify

Run `npm test` and `npm run typecheck` after changing a composition. When
the brief carries numbers ("the title lands by 0.5s"), add a test that
asserts them with `probeAt`/`countAt`. Prefer tests and the studio preview
over rendering video; render only when asked.

Docs: https://smoove.dev
