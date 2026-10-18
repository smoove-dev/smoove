# AGENTS.md

This is a smoove project. smoove is a timeline-driven animation
engine built on top of Konva: a `Composition` owns the frame clock (fps +
durationInFrames), each `Sequence` is a range-gated layer, and you animate
by mutating Konva/smoove nodes inside `sequence.register((frame) => ...)`.
Every animated value must be a pure function of the frame. Import shapes
from `@smoove/core`, not `Konva.*`.

## Before writing composition code

Install and follow the `smoove-video` skill. It covers sequencing,
Flex/Block layout, interpolate-based animation, text, shapes, and media:

    npx skills add smoove-dev/smoove -s smoove-video

## Layout

- `src/composition.js` — the composition. This is the file to edit.
- `src/main.js` — mounts `<smoove-player>`. Rarely needs changes.
- `src/composition.test.js` — headless tests (vitest + `@smoove/core/testing`).

## Verify

Run `npm test` after changing the composition. When the brief carries
numbers ("the title lands by 0.5s"), add a test that asserts them with
the probes in `@smoove/core/testing`. Prefer tests and the dev preview over
rendering video.

Docs: https://smoove.dev
