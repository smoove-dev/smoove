---
"@smoove/core": minor
---

`Text` now re-measures a bare `fontFamily` string once its webfont loads (browser). Previously only the declarative `font` prop reported readiness; a plain `fontFamily` measured against a fallback face and clipped (the "Comfortaa → Rote" bug), forcing an explicit `width` workaround. Core now probes `document.fonts.load(shorthand)` for the family and re-lays-out when it settles — no-op on the server (faces register up front) and harmless for missing/system fonts (it never rejects). Prefer the `font` prop with a `Font` for guaranteed buffering; its `whenReady()`/`isLoaded` remain the reliable readiness signal (unlike `document.fonts.check`, which reports `true` for fonts that don't exist).
