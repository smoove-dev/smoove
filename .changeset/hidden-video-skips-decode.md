---
"@smoove/media": patch
---

A hidden `Video` stops decoding. When the video, or any group above it, is `visible(false)`, it skips the seek and decode for that frame, since nothing would paint it. Its sound plays on: audio follows the sequence range, `setMuted()` and `setVolume()`, never visibility.

That makes hiding the cheap way to cut away from footage. Put a full-screen graphic over the speaker and hide their `Video`, and the voice keeps going while the decoder rests. Showing it again seeks straight to the current frame, and a server render still waits for that frame before capturing it.
