# Media — Image, Audio, Video

> `Audio`/`Video` ship in `@smoove/media` (they pull in `mediabunny`); `Image`
> stays in `@smoove/core`. Add `@smoove/media` as a dependency to use them.

## Image

`Image` (from `@smoove/core`) is a flex-aware, paint-capable wrapper —
unlike raw `Konva.Image` it takes a `src` string directly (no manual
`HTMLImageElement` load/assign) and supports CSS-`object-fit`-style cropping:

```ts
import { Image } from "@smoove/core";

const cover = new Image({
  width: "100%",
  height: 160,
  src: "https://picsum.photos/seed/smoove/800/320", // or a local asset URL
  objectFit: "cover",     // "cover" | "contain" | "fill" | "none"
  objectPosition: "center", // "center" | "top" | "bottom" | "left" | "right" | "top left" | …
  cornerRadius: 10,
});
```

It registers itself with the composition's asset-buffering gate, so
playback/rendering waits for the image to load before painting — drop it
into a `Flex`/`Block` like any other child, no manual readiness handling
needed. Use `Image` for full-bleed backgrounds too, not just cropped/flex
covers — `src` also accepts an already-loaded `HTMLImageElement` if you need
manual load control, so there's no need to reach for raw `Konva.Image`.

## Audio (authoring only — playback wiring, not asset pipeline)

```ts
import { Audio } from "@smoove/media";

main.add(new Audio({
  src: "/audio/track.mp3",
  trimBefore: 30,    // frames trimmed from the start (composition fps)
  trimAfter: 300,    // exclusive frame bound
  loop: false,
  muted: false,
  volume: 0.8,        // 1 = unity; >1 amplifies (e.g. 1.5 for a quiet SFX)
  playbackRate: 1,
}));
```

Instead of the two absolute `trimBefore`/`trimAfter` bounds, you can pass a
`trim` play-window — `{ start, play }` maps to `trimBefore = start`,
`trimAfter = start + play`, so you say "start here, play this long" without
subtracting by hand:

```ts
main.add(new Audio({ src: "/audio/whoosh.mp3", trim: { start: 6, play: 24 } }));
```

`Audio` produces no pixels (no layout/visual props) — it's a Konva node
purely so the engine can mount it inside a `Sequence` and gate it by the
sequence's `[from, from+durationInFrames)` window. `Composition.mixer`
(an `AudioMixer`) is the composition-level bus if you need master
volume/mute across every `Audio`/`Video` node.

### Audio-reactive visuals (`introspect`)

Pass `introspect` and the clip's **real decoded sound** becomes frame-pure
signals on the node — never fake meters from volume automation (automation is
the level you *set*; introspection is the level of the *sound*, and it dips in
a voice-over's pauses where automation stays flat).

```ts
const music = new Audio({ src: musicUrl, introspect: true });           // loudness only
const music = new Audio({ src: musicUrl, introspect: { bands: 24 } });  // + spectrum
```

The readers (all take the **sequence-local frame**, same `f` your updater
receives; `trim`/`loop`/`playbackRate` are mapped for you):

| Reader | Returns |
|---|---|
| `rmsAt(f, { normalized? })` | RMS loudness 0..1 at this frame |
| `peakAt(f, { holdFrames?, normalized? })` | absolute peak; `holdFrames` = max over the trailing window (meter hold bar) |
| `bandsAt(f)` | `Float32Array` of N log-spaced band magnitudes, bass → treble (needs `{ bands: N }`) |
| `noveltyAt(f)` | spectral-flux onset strength 0..1 — spikes on beats (needs bands) |
| `waveform(fromF, toF, buckets)` | static signed `{ min, max }` outline for drawing a waveform |
| `envelope` | `ReadonlySignal<AudioEnvelope \| null>` — the raw tables (`maxRms`, `bands`, …) |

Semantics that matter when authoring:

- **Frame-pure.** The envelope is decoded once *before frame 0* (the
  composition's buffering/render gates wait for it), so scrubbing backwards
  and server renders read identical values. Until it's decoded, readers
  return `0` (or an empty/zeroed array).
- **Pre-fader.** Readings are the file's own loudness, not the mix — multiply
  by your gain for a post-fader meter. `{ normalized: true }` rescales
  against the clip's own loudest moment, so quiet program material still
  fills the meter without hand-tuned gain constants.
- **Costs a real decode** (plus a second fetch of `src` in the browser), so
  enable it only on nodes a visual actually reads. Bands add an FFT fold at
  build time — never per painted frame.

Patterns (visual nodes are core wrappers — see [shapes.md](shapes.md)):

```ts
import { Group, Rect } from "@smoove/core";

// VU meter + peak-hold tick
seq.register((f) => {
  vuFill.width(W * music.rmsAt(f, { normalized: true }));
  vuHold.x(X + W * music.peakAt(f, { holdFrames: 18, normalized: true }));
});

// EQ bars, normalized to the clip's own loudest band (compute the max from
// envelope.get().bands once, not per frame)
seq.register((f) => {
  const bands = music.bandsAt(f);
  bands.forEach((v, k) => eqBars[k]?.height(2 + 200 * Math.min(1, v / maxBand)));
});

// Static waveform: build once when the envelope lands (all-zeros = still decoding)
let drawn = false;
seq.register(() => {
  if (drawn) return;
  const wf = music.waveform(0, TOTAL, 120);
  if (wf.max.every((v) => v === 0)) return;
  drawn = true;
  // size one Rect per bucket from wf.max[i] / wf.min[i]
});

// "Played so far" fill: a bright copy of the waveform inside a Group whose
// clip width tracks the playhead
played.clip({ x: X, y: Y, width: W * (f / TOTAL), height: H });

// Beat-synced motion: threshold the onset curve
if (music.noveltyAt(f) > 0.7) kickScale = 1.2;
```

Per-band peak caps and other trailing-window reads must stay frame-pure: take
a max over `bandsAt(t)` for the trailing frames, never keep decaying state
between frames (see the quantize gotcha in [animation.md](animation.md)).
Working references: the kitchen-sink `audio-visuals`, `eq-spectrum`, and
`audiogram` compositions.

## Video

```ts
import { Video } from "@smoove/media";

main.add(new Video({
  width: "100%", height: "100%",
  src: "/video/clip.mp4",
  objectFit: "cover",
  cornerRadius: 12,
  trimBefore: 0,
  trimAfter: 180,
  loop: false,
  muted: true,
  volume: 1,
  playbackRate: 1,
}));
```

`Video` mirrors `Image`'s layout/crop props (`width`/`height`/`objectFit`/
`objectPosition`/`cornerRadius`, flex-aware) plus `Audio`'s playback props
(`trimBefore`/`trimAfter`/`loop`/`muted`/`volume`/`playbackRate`). Like
`Image`, it self-registers with the buffering gate.

`startFrom`/`endAt` are deprecated aliases of `trimBefore`/`trimAfter`
(pre-Remotion-v4.0.319 names) — prefer the new names in new code.

This skill stops at *authoring* media nodes in a composition. Encoding,
server-side rendering, and asset-pipeline concerns (`@smoove/renderer`) are
out of scope.
