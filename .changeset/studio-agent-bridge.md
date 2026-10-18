---
"@smoove/agent": patch
"@smoove/vite": patch
"@smoove/studio": patch
"@smoove/media": patch
---

A coding agent can now see the studio. The new `@smoove/agent` package is a dev-server bridge: while the studio runs, an agent asks the open tab for its status, moves it to a composition and frame, and gets a frame back as a PNG under `.smoove/snaps/`, drawn by the real tab without moving the user's playhead. `@smoove/vite` mounts the bridge in development (turn it off with `smoove({ agent: false })`), it writes `.smoove/agent.json` with the URL and a per-run token, and `<Studio>` connects to it unless you pass `agent={false}`. In the preview, a seeking video now holds `renderFrame()` until the right frame lands, so a snapshot shows the video at the requested frame.
