# AGENTS.md

This is a smoove project. smoove brings Remotion-style timeline-driven
animation to Konva: a `Composition` owns the frame clock (fps +
durationInFrames), each `Sequence` is a range-gated layer, and you animate
by mutating Konva/smoove nodes inside `sequence.register((frame) => ...)`.
Every animated value must be a pure function of the frame. Import shapes
from `@smoove/core`, not `Konva.*`.

## Before writing composition code

Install and follow the `smoove-video` skill. It covers sequencing,
Flex/Block layout, interpolate-based animation, text, shapes, and media:

    npx skills add smoove-dev/smoove

## Layout

- `src/composition.ts` — the composition. This is the file to edit.
- `src/main.ts` — mounts `<smoove-player>`. Rarely needs changes.

Docs: https://smoove.dev
