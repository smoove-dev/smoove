---
"@smoove/lottie": patch
---

New package: `@smoove/lottie`, for playing Lottie animations on the smoove
timeline.

A Lottie file carries its own frame rate. The `Lottie` node maps your
composition's frames onto it, including the positions between the animation's
own frames, so a 24 fps animation runs on a 30 fps timeline without stuttering
and without anything needing to match.

```ts
import { Lottie } from "@smoove/lottie";

main.add(new Lottie({ src: "/spinner.json", width: 240, height: 240, loop: true }));
```

`speed`, `loop`, `segment`, `marker`, `trimBefore` and `trimAfter` control what
plays and when. Sizing, `objectFit`, `objectPosition` and `cornerRadius` are
spelled the way `Image` and `Video` spell them, and the node lays out inside a
`Flex` like any other child.

Drawing goes through a WebAssembly rasterizer, the same one in the browser and
in a headless render. The browser fetches it from a CDN unless you point
`setLottieWasmUrl` at your own copy; Node reads it from disk and needs no
network.
