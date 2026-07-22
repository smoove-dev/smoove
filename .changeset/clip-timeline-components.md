---
"@smoove/core": patch
---

feat: Clip nested timelines and shareable components. `Clip` is a range-gated, tickable Group with Sequence's option set (`from`/`durationInFrames`/`until`/`span`), nestable to any depth; components are plain functions returning a Clip. Updaters on Sequence and Clip now receive a second `FrameInfo` argument (`{ time, fps, durationInFrames, globalFrame }`). Every smoove node gains `getComposition()`/`getSequence()`/`getClip()`, and Composition/Sequence/Clip gain structure-version-cached `query()`/`queryOne()`. Sequence's internals moved onto a shared timeline mixin; public behavior is unchanged. Also fixes a flex layout bug: children of an `alignItems: "center"`/`"flex-end"` container with a hug (auto) cross size rendered at NaN positions (flexily computes the cross offset against the unresolved size); write-back now re-derives the offset from the resolved sizes.
