# @smoove/media

Audio and Video nodes for [smoove](https://smoove.dev). Footage and sound
play on the composition's frame clock: every frame maps to a fixed point in
the media, so preview, scrub, and render all line up.

Importing the package registers its browser decoders (built on
[mediabunny](https://mediabunny.dev)) as the engine's defaults, so in the
browser there is nothing else to wire up. Keeping the decoders here is what
keeps `@smoove/core` light.

## Install

```sh
pnpm add konva @smoove/core @smoove/media
```

`konva` is a peer dependency.

## Quick example

```ts
import { Composition, Sequence } from "@smoove/core";
import { Audio, Video } from "@smoove/media";

const comp = new Composition({ id: "clip", fps: 30, durationInFrames: 300, width: 1280, height: 720 });

const seq = new Sequence();
seq.add(new Video({ src: clipUrl, width: "100%", height: "100%", objectFit: "cover", muted: true }));
seq.add(new Audio({ src: musicUrl, volume: 0.8, trim: { start: 30, play: 270 } }));
comp.add(seq);
```

`Video` takes the same layout and crop props as core's `Image` (`width`,
`height`, `objectFit`, `objectPosition`, `cornerRadius`, flex-aware) plus the
playback props (`trimBefore`, `trimAfter`, `loop`, `muted`, `volume`,
`playbackRate`). `Audio` produces no pixels: it takes only the playback
props, and its sequence range-gates when it plays. The composition's mixer
(`comp.mixer`) is the master bus across every track.

## Read the sound

Pass `introspect` and the clip's real loudness becomes a frame-pure signal
for audio-reactive visuals: meters, EQ bars, waveforms, beat-synced motion.

```ts
const music = new Audio({ src: musicUrl, introspect: { bands: 24 } });

seq.register((f) => {
  meter.width(300 * music.rmsAt(f, { normalized: true })); // real loudness, 0..1
  const bands = music.bandsAt(f);                          // spectrum, bass first
  if (music.noveltyAt(f) > 0.7) kick();                    // onset spike
});
```

The envelope is decoded once before frame 0, so scrubbing backwards and
server renders read identical values. `peakAt(f, { holdFrames })` gives a
meter hold bar, `waveform(from, to, buckets)` returns a static outline for
drawing, and the raw table lives on `music.envelope`.

## Server rendering

`@smoove/renderer` registers Node decoders before a composition is built, and
the same composition code renders to MP4 unchanged. Import order doesn't
matter: the renderer's decoders win either way.

## Docs

Full documentation lives at [smoove.dev](https://smoove.dev): see the Audio
and Video pages under Media.

## License

MIT
