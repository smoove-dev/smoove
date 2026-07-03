---
name: smoove-best-practices
description: Use when running, previewing, embedding, or rendering a smoove (@smoove/*) Composition — wiring <smoove-player>, building a <Studio> app, or rendering to MP4/WebM with @smoove/renderer — including debugging a blank player, missing render fonts or assets, or studio integration failures.
metadata:
  tags: smoove, player, studio, renderer, konva, video, rendering, ssr
---

## When to use

You have a smoove `Composition` and need to **run, preview, embed, or render**
it: dropping `<smoove-player>` onto a page, assembling a `<Studio>` app, or
turning a composition into an MP4/WebM with `@smoove/renderer`. Also use it to
diagnose the classic failures — a player that renders blank, a render whose
fonts or media are wrong, or a studio that won't mount.

**Out of scope:** authoring the `composition.ts` itself (timeline scenes,
Flex/Block layout, `interpolate`, Text/shapes/media). That's the
**smoove-video** skill. This skill starts once a composition exists.

## Runtime mental model

Everything hangs off one invariant: **a composition is a pure function of its
frame.** `comp.setFrame(n)` produces the same pixels anywhere — browser or
Node. The three subsystems are just different clocks driving that function:

- **Player** drives the clock in real time via `requestAnimationFrame` and
  paints to an on-page canvas.
- **Renderer** walks the clock frame-by-frame headlessly, rasterizing each
  frame with skia and encoding to a file. No real time, no rAF.
- **Studio** is a React shell around the player plus a registry of
  compositions; the renderer powers its export dialogs.

**"What you preview is what you ship" holds only if the composition is
deterministic.** Anything not derived from `frame` + `props` —
`Date.now()`, `Math.random()`, `setInterval` — looks fine in the player and
diverges (or breaks) in the renderer. If a render disagrees with the preview,
suspect non-determinism first and check the authoring rules in **smoove-video**.

Assets (fonts, images, video) load **asynchronously**. The composition buffers
and paints nothing until they're ready — so a "blank" surface is often "still
buffering" or "asset failed to load", not a broken clock.

## The three subsystems

Read the one that matches your task — each is a short how-to plus a
fast-fix gotchas list.

| Task | Read |
| --- | --- |
| Embed/play a composition on a page (HTML, React, Vue, CDN) | [rules/player.md](rules/player.md) |
| Build an editor UI: catalog, stage, timeline, props, export | [rules/studio.md](rules/studio.md) |
| Render to MP4/WebM or stills from Node | [rules/renderer.md](rules/renderer.md) |

## Fast triage

| Symptom | Likely cause → where |
| --- | --- |
| Player is blank, no error | Composition set as *attribute* not *property*; or SSR hydration recreated it; or assets still buffering → [player.md](rules/player.md) |
| Player intermittently blank on refresh (SSR/hydration) | Mount client-only → [player.md](rules/player.md) |
| Player is 0×0 / off-screen | `styles.css` width cascade → [player.md](rules/player.md) |
| Render throws "not in rendering mode" | `@smoove/renderer/register` imported after building the comp → [renderer.md](rules/renderer.md) |
| Render fonts wrong / fall back | Fonts not registered server-side → [renderer.md](rules/renderer.md) |
| Render "could not probe video" / media missing | Asset URL not mapped to an fs path → [renderer.md](rules/renderer.md) |
| Studio: "Cannot read properties of null" | Duplicate React; dedupe react/react-dom → [studio.md](rules/studio.md) |
| Studio export dialogs do nothing | `@smoove/renderer` optional peer not installed → [studio.md](rules/studio.md) |
