---
"@smoove/transitions": patch
---

Fix scene bleed-through during Tier B (GL) transitions. The two scene layers a shader transition blends were still painting at full opacity beneath the overlay, so wherever the composited overlay wasn't fully opaque (e.g. a scene that reads over a shared base layer) the raw layers showed through — the incoming scene appeared from the transition's first frame and the outgoing scene lingered on its last. The overlay now hides both scene layers for the duration of the overlap so only the blended result paints, over the same backdrop each scene composites over normally. The incoming scene is drawn synchronously on the frame it is revealed so live preview doesn't flash a stale frame after the transition ends.
