---
"@smoove/effects": patch
---

Add `blur` to `@smoove/effects`, with two kernels behind one factory. `node.effects([blur({ radius: 24 })])` is the default `gaussian` type: a single canvas filter, which Skia implements natively and browsers run on the GPU, and which never reads pixels back. `blur({ type: "lens", radius: 32, bloom: 0.7, blades: 6 })` is what a camera does instead. A Gaussian kernel falls off toward its edge, so a bright highlight dims as it spreads and the picture reads as frosted glass. A lens defocuses through a flat aperture, so the highlight keeps its brightness and grows into a bokeh ball. `bloom` sets how hard those highlights hold up, and `blades` gives the defocus the shape of an iris.

`radius` means the same amount of blur under either type, so switching `type` changes the character of a shot and not its strength, and a focus pull is `focus.radius = interpolate(frame, [0, 24], [40, 0])` in a frame callback. At `radius: 0` the effect switches off and the node draws through the normal path. `gaussian` runs anywhere a canvas does; `lens` needs WebGL, which the browser player and the server renderer both provide. Neither reads a clock, so both scrub and render the same.
