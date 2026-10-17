---
"@smoove/renderer": patch
---

Fix server renders getting slower the longer they run, on compositions that use shader effects or shader transitions. The canvas that carries a GL frame back into skia was never truncated, so each readback appended to a drawing record that the next pixel read replayed from the start. Cost grew with frame count, and a long export could crawl to a halt well before it finished.

Per-frame cost now holds flat for the length of a render. On a 400 frame shader-effect composition at 1280x720, the last twenty frames used to cost eight times what the first twenty did, with memory climbing past 1.7 GB. Both stay steady.
