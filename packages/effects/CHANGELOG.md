# @smoove/effects

## 0.4.2

### Patch Changes

- Updated dependencies [[`5b2420d`](https://github.com/smoove-dev/smoove/commit/5b2420da72645d8c30c4bd90a2e9f9b93c151f44)]:
  - @smoove/core@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [[`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b), [`cc4cd88`](https://github.com/smoove-dev/smoove/commit/cc4cd88ee6416aaf6989a280fa9e509a2634644b)]:
  - @smoove/core@0.4.1

## 0.4.0

### Patch Changes

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `@smoove/effects` with `flameWrap`: fire wrapped around a node, with heat distortion, sparks, a molten rim, smoke and scorching. It wraps the node's rounded box by default (`radius` to match your corners) or its alpha edge with `shape: "silhouette"`, so a burning `Text` burns letter by letter. Nodes and Sequences gain an `effects` chain (`card.effects([flameWrap()])`), and effects read the frame clock, so a burn scrubs and renders the same in the browser and on the server.

  The WebGL bridge moves from `@smoove/transitions` into `@smoove/core` so both transitions and effects share one compositor. Everything is re-exported from `@smoove/transitions`, so existing imports keep working.

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `chromaKey` to `@smoove/effects`: green-screen keying, so one colour becomes transparency and the scene behind the clip shows through. `clip.effects([chromaKey({ color: "[#249530](https://github.com/smoove-dev/smoove/issues/249530)" })])`, sampling that hex off a frame of your own footage rather than guessing at `#00ff00`. What survives is despilled at unchanged brightness, and `choke` trims the half-green rim compression leaves around a subject.

  The matte ignores brightness, so a shadow across the screen keys like the lit part of it, and its distance is measured against the key colour's own distance from grey, so a `similarity` that worked on a bright screen still works on a dull one and a white shirt in front of it survives either way. `strength` crossfades the whole key, so animating it from 0 dissolves the background away. The key reads pixels and no clock, so it scrubs and renders the same in the browser and on the server.

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `blur` to `@smoove/effects`, with two kernels behind one factory. `node.effects([blur({ radius: 24 })])` is the default `gaussian` type: a single canvas filter, which Skia implements natively and browsers run on the GPU, and which never reads pixels back. `blur({ type: "lens", radius: 32, bloom: 0.7, blades: 6 })` is what a camera does instead. A Gaussian kernel falls off toward its edge, so a bright highlight dims as it spreads and the picture reads as frosted glass. A lens defocuses through a flat aperture, so the highlight keeps its brightness and grows into a bokeh ball. `bloom` sets how hard those highlights hold up, and `blades` gives the defocus the shape of an iris.

  `radius` means the same amount of blur under either type, so switching `type` changes the character of a shot and not its strength, and a focus pull is `focus.radius = interpolate(frame, [0, 24], [40, 0])` in a frame callback. At `radius: 0` the effect switches off and the node draws through the normal path. `gaussian` runs anywhere a canvas does; `lens` needs WebGL, which the browser player and the server renderer both provide. Neither reads a clock, so both scrub and render the same.

- [#29](https://github.com/smoove-dev/smoove/pull/29) [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326) Thanks [@shemi](https://github.com/shemi)! - Add `droplets` to `@smoove/effects`: rain running down a pane of glass in front of a node. Drops swell, let go and slide, leaving wet trails through the fog, with a fine drizzle between them and everything behind bending through the water. `node.effects([droplets({ intensity: 1, blur: 4 })])`, then animate `intensity` for a squall that arrives and passes.

  The glass is the node's own box and every pixel is gated on the node's alpha, so the effect asks for no padding and never paints outside what the node already covered. Lengths are in CSS px, so a 2x render matches its 1x preview, and the rain reads only from the frame clock, so it scrubs and renders the same in the browser and on the server.

- Updated dependencies [[`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`db1ff40`](https://github.com/smoove-dev/smoove/commit/db1ff40dde7e490867d1f344b78389c5ceec2326), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af), [`7afbe52`](https://github.com/smoove-dev/smoove/commit/7afbe528fb59a5615c8c8dc522c290d5c54d70af)]:
  - @smoove/core@0.4.0
