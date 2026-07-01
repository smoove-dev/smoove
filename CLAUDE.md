# CLAUDE.md

`smoove` brings Remotion-style timeline-driven animation to
[Konva](https://konvajs.org): `Composition extends Konva.Stage` owns a frame
clock, and `Sequence extends Konva.Layer` is a range-gated layer.

Repo layout, conventions, and commands live in [`AGENTS.md`](./AGENTS.md).
That file is the single source of truth for working in this codebase. It's
kept tool-agnostic on purpose, so it doesn't drift out of sync with this
one. Read it first.
