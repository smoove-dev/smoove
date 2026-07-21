---
"@smoove/media": patch
---

`probeMedia(src)` reads a media file's container metadata (duration, video size, track shape) without decoding frames, in the browser and in Node. Await it at module top level and feed `meta.durationInFrames(fps)` into a timeline plan so real clip lengths drive the beat layout. Results are memoized per src.
