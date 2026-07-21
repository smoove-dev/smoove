---
"@smoove/core": patch
---

Declared timeline markers for planning a composition up front. `new Marker({ start, durationInFrames })` creates a named time range directly (start accepts any anchor, so markers chain: `start: intro.end`), and `plan()` lays out a whole set of named beats in one call with per-beat gap/overlap offsets. `Composition` now accepts a marker point as `durationInFrames` (resolved lazily, so the comp ends where the last beat ends), and `Sequence` gains `span: marker` as sugar for covering exactly a marker's range. Declared and Series-derived markers interoperate: either can anchor the other.
