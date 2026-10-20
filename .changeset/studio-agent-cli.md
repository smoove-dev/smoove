---
"@smoove/cli": patch
"@smoove/agent": patch
"@smoove/studio": patch
"@smoove/core": patch
"@smoove/media": patch
---

The `smoove` command. Run it from a studio project: `smoove agent start` runs the dev server in the background and prints the URL to give the user, `smoove agent snap` and `smoove agent sheet` write a frame or a contact sheet (one tile per beat) as a PNG, `smoove agent timeline` lists the beats and sequences in frames, `smoove agent seek` moves the user's playhead, and `smoove render` renders through the studio's queue. Every command takes `--json`. A request about a composition nobody has open goes to a headless Chrome the dev server starts on its own, so looking never changes what the user sees.

In core, `plan()` names each marker after its key (`marker.name`), and a composition takes its plan with `new Composition({ plan })` or `comp.setPlan()`, so tools can find each beat. In the preview, a video that's still loading now holds `renderFrame()` until it can draw the requested frame.
