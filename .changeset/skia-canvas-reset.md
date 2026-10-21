---
"@smoove/core": patch
"@smoove/renderer": patch
---

Server renders and composition tests no longer run out of memory on compositions with video.

skia-canvas records every draw and replays the whole recording on each pixel read, and `clearRect` only adds to that recording. The Node video source, every Sequence layer and `captureCanvas()` cleared that way each frame, so they kept every frame they ever drew. A one-minute 1080p `Video` grew a `smoove test` run past 6 GB within a minute, and rendering it slowed from 16 fps to 8 fps before running out of memory. These canvases now `reset()` instead, which drops the recording. The same composition now renders all 1,817 frames at about 62 fps with memory flat under 1 GB.
