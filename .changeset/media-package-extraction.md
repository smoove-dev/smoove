---
"@smoove/core": minor
"@smoove/media": minor
---

Extract the `Audio` and `Video` nodes (and their `mediabunny` decoders) into a
new `@smoove/media` package. `@smoove/core` no longer depends on `mediabunny`
(~10 MB) and no longer exports `Audio`, `Video`, `AudioConfig`, `VideoConfig`,
`BrowserAudioSource`, `MediabunnyAudioSource`, `BrowserVideoSource`, or
`MediabunnyVideoSource`.

**Migration:** import media authoring from `@smoove/media` and add it as a
dependency:

```ts
// before
import { Audio, Video } from "@smoove/core";
// after
import { Audio, Video } from "@smoove/media";
```

Importing `@smoove/media` (browser) auto-registers its sources. `isAudioNode` /
`isVideoNode` remain exported from `@smoove/core`. `@smoove/renderer` is
unchanged for correctly-importing apps.
