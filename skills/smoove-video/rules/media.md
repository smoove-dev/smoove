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

`cornerRadius` takes one number or `[topLeft, topRight, bottomRight,
bottomLeft]`, and clamps the way CSS does: radii that overflow an edge scale
down together, so `cornerRadius: 9999` on a square box is a disc rather than
a squircle.

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

For analysis without a node, `buildEnvelope(src, opts)` and the
`envelopeRmsAt` family are exported as plain functions (they take media-time
seconds, not frames). Advanced escape hatch: `audio.source` / `video.source`
return the live media source, and the default Mediabunny sources expose their
`input` demuxer; read from it, never dispose it.

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

## Know a clip's length up front (`probeMedia`)

`probeMedia(src)` reads a file's container metadata (no frame decoding, so
it's cheap) and works on URLs in the browser and file paths in Node. Await it
at module top level, before building the comp, and let real clip lengths
drive the timeline plan (see "Plan the timeline first" in
[sequencing.md](sequencing.md)):

```ts
import { probeMedia } from "@smoove/media";

const meta = await probeMedia(heroClip); // { duration, width, height, hasAudio, ... }

const { hero } = plan({
  hero: { durationInFrames: meta.durationInFrames(fps) }, // floor(duration * fps)
});
```

`durationInFrames(fps)` floors, so the planned window never outruns the
media. Results are memoized per `src`; probing a clip and then mounting it as
a `Video` costs one metadata read. Because the probe runs once at module
load, the values are constants for the life of the comp and frame-purity
holds.

Probe for edit planning too, not just playback: the source's `width`/
`height` drive the reframe below, `hasAudio` tells you whether the cut needs
audio fades, and the duration bounds every trim you compute from a
transcript.

## Editing real footage

"Cut the quiet moments" and "make it vertical" are edits, not placement.

### Cutting

Two ways, with different costs:

- One `Video` per kept segment, each in its own `Sequence` with
  `trimBefore`/`trimAfter`. Everything stays in smoove, but every segment is
  its own decoder. Fine for a handful of cuts.
- Pre-cut the footage outside smoove (ffmpeg, from the same segment list) and
  play one `Video`. One decoder however many cuts, so it scales to dozens.
  Keep the segment list as data next to the comp so cues can still map
  source time to output frames.

```ts
// a few cuts: one Video per segment, back to back
const keep = [[0, 212], [260, 431], [470, 618]]; // source frames, comp fps
const edit = new Series();
for (const [a, b] of keep) {
  edit.add({ durationInFrames: b - a }, (seq) => {
    const clip = new Video({ src: talkUrl, width: W, height: H, objectFit: "cover", trimBefore: a, trimAfter: b });
    seq.add(clip);
    // short audio fades at both ends, so a cut never clicks
    seq.register((f) => clip.setVolume(interpolate(f, [0, 2, b - a - 2, b - a], [0, 1, 1, 0])));
  });
}
comp.add(edit);
```

Either way, snap every boundary to the composition's frame grid. Convert
transcript seconds once with `Math.round(t * fps)` and use those integers
for the trims, the pre-cut (as times `k / fps`, encoded at the comp's fps)
and the cue table alike. Sub-frame leftovers add up across many cuts, and
audio and video drift apart. With one pre-cut `Video`, put the fades in the
cut itself (`afade`) or drive `setVolume()` from the segment list the same
way.

### Reframing 16:9 to 9:16

`objectFit: "cover"` with `objectPosition` picks one fixed crop; it can't pan
or zoom over time. To follow a speaker, size the `Video` to the source at a
base scale that fills the frame height, then set `x`/`y`/`scale` every frame
so a subject point (a face track, or hand-placed keys) stays centred,
clamped so no edge of the source shows:

```ts
const meta = await probeMedia(talkUrl); // 1920x1080
const BASE = H / meta.height; // zoom 1 fills the 1920px-tall frame
const video = new Video({ src: talkUrl, width: meta.width * BASE, height: meta.height * BASE, objectFit: "fill" });
talk.add(video);

talk.register((frame) => {
  const seg = segmentAt(frame);
  const z = seg.index % 2 ? 1.16 : 1; // alternate wide and tight on every cut
  const s = BASE * z;
  const { x: fx, y: fy } = faceAt(frame); // subject point in source px
  video.scaleX(z);
  video.scaleY(z);
  video.x(Math.min(0, Math.max(W - meta.width * s, W / 2 - fx * s)));
  video.y(Math.min(0, Math.max(H - meta.height * s, H * 0.3 - fy * s)));
});
```

Alternating the zoom between wide and tight on every cut turns a jump cut
into a deliberate punch-in. A slow drift-in within each segment keeps a
static lecture shot alive.

### Cutting away: cover the speaker, hide the picture

Visibility controls a `Video`'s picture, never its sound:

- `visible(false)` on the video, or on any group above it, stops the
  picture. Nothing is painted and nothing is decoded.
- The sound follows the `Sequence`'s range, `setMuted()` and `setVolume()`.
  A hidden video keeps talking.
- To silence it, `setMuted(true)`, `setVolume(0)`, or end its range.

So when a graphic takes the screen and the speaker should keep talking, put
the graphics in a later sequence (later `comp.add` paints on top, see
[sequencing.md](sequencing.md)) over an opaque full-frame background, and
hide the speaker's `Video` for the same frames. The voice plays on and the
decoder rests while nobody can see it:

```ts
const onStage = merge(windows); // see "Graphics only while they move"
const covered = (f: number) => onStage.some(([a, b]) => f >= a && f < b);

gfx.register((frame) => stageBg.visible(covered(frame)));
talk.register((frame) => video.visible(!covered(frame))); // picture off, sound on
```

Showing it again seeks straight to the current frame, and a server render
waits for that frame before capturing it. (On `@smoove/media` 0.4.0 and
earlier a hidden video still decodes; the sound is the same either way.)

Two things not to hide with: the `Sequence` itself (its visibility belongs
to the engine, which sets it from the range), and `opacity(0)` (a
transparent video still decodes, so keep fades short). Oversize the stage
background a little if anything shakes the layer.

This skill stops at *authoring* media nodes in a composition. Encoding,
server-side rendering, and asset-pipeline concerns (`@smoove/renderer`) are
out of scope.
