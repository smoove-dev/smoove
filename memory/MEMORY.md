# Memory index

- [skia-canvas leak root cause](skia-canvas-leak-root-cause.md) — renderer leak = drawing onto an uncleared canvas retains a snapshot/frame; fixed by one clearRect in the video source. Parallel is now speed-only, not a memory necessity.
