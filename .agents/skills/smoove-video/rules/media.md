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
  volume: 0.8,        // 0..1
  playbackRate: 1,
}));
```

`Audio` produces no pixels (no layout/visual props) — it's a Konva node
purely so the engine can mount it inside a `Sequence` and gate it by the
sequence's `[from, from+durationInFrames)` window. `Composition.mixer`
(an `AudioMixer`) is the composition-level bus if you need master
volume/mute across every `Audio`/`Video` node.

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
