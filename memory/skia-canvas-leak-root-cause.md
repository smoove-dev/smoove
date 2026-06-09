---
name: skia-canvas-leak-root-cause
description: The renderer's skia-canvas memory leak is "drawing onto an uncleared canvas retains a snapshot per frame"; fixed by one clearRect in the video source. Parallel rendering is now speed-only, not a memory necessity.
metadata:
  type: project
---

The `@konva-motion/renderer` "skia-canvas leaks native memory, only process exit
reclaims it" problem (the whole justification for the multi-process parallel
design in `doc/renderer-parallel-prompt.md`) was root-caused on 2026-06-09 via
isolation tests (`packages/renderer/scratch/leak-test.mjs`) and a real-pipeline
harness (`scratch/validate-video-leak.mjs`).

**Root cause:** skia-canvas retains a native, GC-invisible snapshot of a canvas's
PRIOR content every time you draw onto it WITHOUT first clearing. So a per-frame
`putImageData` (or `drawImage`) onto the same canvas leaks ~one frame of RSS per
frame, for the process lifetime. It is per-call and unbounded (identical content
still leaks; a looping video does NOT plateau). GPU on/off makes no difference.
Calling `clearRect(0,0,w,h)` before the draw releases the prior snapshot → flat.

This unifies every symptom: the video source's `_paint` did `putImageData`
without clearing (the one un-cleared draw site in the pipeline). Konva's
`Layer.drawScene` and `Composition.captureCanvas` (composition.ts:335) ALREADY
clearRect before drawing, so they never leaked — non-video comps were always flat.

**The fix (one line, shipped in video-source-ffmpeg.ts `_paint`):**
`ctx.clearRect(0,0,this._width,this._height)` immediately before `putImageData`.
Real-pipeline result at full-res 1080², s3c.mp4, NO videoDecodeCap: RSS plateaus
at ~245 MB and is IDENTICAL at 600 and 1200 frames (was 111→1750 MB leaking
before). Throughput ~250-380 fps. Colors correct. No BMP/reused-Image, no capture
rewrite, no core changes needed.

**Why this matters:** memory is now bounded and independent of render length in a
SINGLE process, for video too. The multi-process design's memory justification is
gone — parallel rendering becomes a pure SPEED optimization (still wanted, but not
required for correctness/memory). `videoDecodeCap` becomes optional. Earlier in
this same investigation I wrongly concluded (a) the fix needed a BMP/reused-Image
source rewrite, then (b) that it needed an invasive raw-buffer capture composite
or multi-process — both wrong; the real cause was the missing clearRect.

**How to apply:** when building the parallel renderer, treat it as speed-only — no
memory-driven chunking, no need for short-lived fork-per-chunk workers, could use
worker_threads. Update `doc/renderer.md` Performance notes (the skia-leak section)
and the "Out of scope" note. See [[renderer-parallel-design]] when written.
