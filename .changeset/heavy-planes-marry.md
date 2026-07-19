---
"@smoove/core": patch
"@smoove/transitions": patch
---

Timeline markers: name a scene in a `Series` or `TransitionSeries` and anchor anything to it. `series.marker("code")` returns a lazily-resolving handle with `start`, `end`, and `settled` points (each offsettable via `.add(n)`); `from:` accepts a marker anywhere a frame number worked, `Sequence` gains a marker-aware `until:`, and standalone sequences hand out their own via `sequence.marker()`. Retime a beat and every cue anchored to it moves in lockstep.
