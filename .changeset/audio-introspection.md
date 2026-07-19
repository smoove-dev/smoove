---
"@smoove/media": minor
---

Audio introspection: pass `introspect: true` (or `{ bands: N }`) to `Audio` and
read the clip's real sound as frame-pure signals — `rmsAt(frame)` /
`peakAt(frame, { holdFrames })` for loudness (with a `{ normalized: true }`
option), `bandsAt(frame)` / `noveltyAt(frame)` for spectrum and onsets,
`waveform(from, to, buckets)` for a static outline, and the raw table on the
`audio.envelope` signal (exported as `AudioEnvelope`). Everything is decoded
once before frame 0 in both preview and server renders, so audio-reactive
visuals (meters, EQ bars, waveforms, beat-synced motion) scrub and render
deterministically.
