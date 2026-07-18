# API-additions triage & roadmap — audio, text measurement, media extraction

Date: 2026-07-18
Type: triage / sequencing note. Turns the seven "API additions" feature
requests raised while building the showcase composition into a sequenced,
grounded backlog, plus a media-decoupling decision. Companion to
`2026-07-15-smoove-showcase-video-design.md`.

Status: **planning only.** Nothing here is implemented yet.

---

## The one fact that reframes the whole list: server ≠ client for audio

The source note's thesis — *"the framework already has what the frame function
needs; it just isn't handing it over"* — is **true in the browser and false on
the server**, and that split is the biggest risk in the backlog.

- **Browser preview:** `MediabunnyAudioSource` decodes into an `AudioBufferSink`
  (`packages/core/src/media/audio/audio-source-mediabunny.ts`). The PCM samples
  genuinely sit in memory, so `rmsAt(frame)` is feasible.
- **Server render:** `packages/core/src/media/audio/asset.ts` is explicit —
  *"The engine never decodes audio while capturing canvas frames."* It records
  `AudioAsset` samples (volume **automation**, not amplitude) for an external
  mux pass. At frame-draw time there is **no decoded PCM on the server at all.**

Consequence: anything amplitude-derived (#1, `trimSilence`, `normalize`) needs a
**separate up-front decode pass** on the server, and the whole envelope must be
resolved **before frame 0** so `rmsAt` can stay frame-pure (async decode →
synchronous read). That is the crux that makes #1 high-value but not quick.

---

## Triage

Ordered as they appear in the source note; effort/parity are the added columns.

| # | Item | Effort | Server/client parity | Notes |
|---|------|--------|----------------------|-------|
| 6 | `fill()` / `font()` post-construction setters | Quick | Identical | Pure Konva prop + redraw. Kills the transparent-`highlight` tint hack. Note: core `Text` extends `Konva.Group`, not `Konva.Text`, so `fill` is a custom prop needing a real setter. |
| 7a | Play-window trims `{ start, play }` | Quick | Identical | Arithmetic sugar over `trimBefore`/`trimAfter`. No runtime. |
| 7b | Raw gain > 1.0 | Quick | Two paths | Browser: `GainNode` > 1 trivially. Server mux pass must apply the same gain. `normalize` is NOT quick (depends on #1). |
| 2 | Font-aware Text measurement + real `.ready` | Quick–Med | Both (browser needs re-measure) | **Best ROI.** Seam already exists: `loadFontFace()` returns a shared dedup promise (`runtime-defaults.ts`); `text.ts:143` already flags the race. Server loads fonts up front so it is mostly correct there already. `.ready` = wrap the existing promise; drop the broken `document.fonts.check()`. |
| 4 | Timeline markers / cue anchoring | Med | Identical | Pure timeline bookkeeping, no media runtime, no parity risk. Touches `Series` / `TransitionSeries`. |
| 3 | Lifetime-independent `node.measure()` | Med | Identical (pure layout) | Off-stage measure of a detached `Konva.Text` already works via `_measure`; the hard parts are glyph/ink bounds vs box, and running flex layout on demand. Depends on #2 for accuracy. |
| 5 | Knockout / reveal `Mask` node | Med–High | Fiddly both | Cached-canvas `destination-out` works in skia + browser, but cache + font timing re-triggers the #2 race. Build on top of #2. |
| 1 | Audio introspection (`rmsAt` / `peakAt` / `envelope`) | High | Different code paths | Highest value; replaces `scripts/envelope.py`. Requires a pre-decode envelope pass that gates readiness — nearly free in the browser (sink exists), a new decode step on the server. |
| 7c | One sequencing model + untyped `TransitionSeries` cast | Design | Identical | Not a code quick win — needs an API decision (shared-vs-added overlap) before coding. |

---

## Media extraction — cut the *dependency*, don't move the *tree*

The heavy dep is **mediabunny (~10 MB installed)**. It enters `core` in exactly
three places, all behind the existing dependency-injection seam:

- `engine/runtime-defaults.ts` sets `MediabunnyAudioSource` /
  `MediabunnyVideoSource` as the **default factories**.
- `media/audio/audio-source-mediabunny.ts` and
  `media/video/video-source-mediabunny.ts` — the concrete decoders.

But `media/` is **not** cleanly severable from the engine:
`engine/composition.ts` owns the `AudioMixer` and walks `FONT_MARK`/`MEDIA_MARK`;
`engine/sequence.ts` imports `MEDIA_MARK`/`TICK_MARK`. Moving the whole `media/`
tree out means untangling the composition's mixer — invasive and breaking.

**80/20 move:** keep the `Audio`/`Video` nodes, mixer, drivers, and source
*interfaces* in core (all lightweight, no mediabunny), and lift only the two
concrete `Mediabunny*Source` classes into a self-registering entrypoint that
calls `setDefaultAudioSourceFactory` / `setDefaultVideoSourceFactory` on import.
Core drops `mediabunny` from its `dependencies`; apps that use media add one
import. The seam is already proven — `@smoove/renderer` swaps these same
factories server-side today.

Open question before doing this: separate entrypoint within `@smoove/core`
(e.g. `@smoove/core/media-browser`) vs a new `@smoove/media` package. The
subpath entrypoint is less packaging overhead (no new changeset-group entry, no
trusted-publisher registration) and probably the right first step.

---

## Backlog (sequenced by ROI — quick wins first)

1. `fill()` / `font()` setters on `Text` — delete the transparent-`highlight`
   tint hack (#6).
2. Play-window trims `{ start, play }` + raw gain > 1.0 (#7a/b).
3. **Font-aware Text measurement + `font.ready` signal** — re-measure on
   `loadFontFace` resolve, drop `fonts.check()` (#2). *Highest ROI.*
4. **Decouple mediabunny from core** — lift `Mediabunny*Source` to a
   self-registering entrypoint, drop the core dep (minimal-churn variant above).
5. Timeline markers / cues — `series.marker()`, `audio(...).at(marker)` (#4).
6. Lifetime-independent `node.measure()` with glyph bounds (#3, builds on 3).
7. `Mask` knockout / reveal node (#5, builds on 3).
8. **Audio envelope introspection** — browser sink + server pre-decode pass;
   kills `scripts/envelope.py` (#1). *Highest value, do last.*
9. Design decision: unify `TransitionSeries` vs hand-placed overlap, and fix the
   typed-`Composition` → untyped cast (#7c). Needs a call before coding.

---

## Parity checklist (apply to every item before calling it done)

- [ ] Works via `setFrame(n)` in Node (offline/server), not only under `play()`.
- [ ] Frame-pure: same frame in → same output out, no dependence on prior
      playback or on-stage lifetime.
- [ ] Any async resource (font face, decoded envelope) is resolved **before**
      the first frame it affects, and exposes a readiness signal.
- [ ] Amplitude/decode features have an explicit server code path — do not
      assume browser-decoded PCM is present at render time.
