---
"@smoove/media": patch
---

Escape hatches for advanced media work. `audio.source` and `video.source`
return the node's live media source, and the default Mediabunny sources
expose their `input` demuxer for direct mediabunny access (track metadata,
extra sinks). The audio analysis utilities also ship as plain functions:
`buildEnvelope(src, opts)` decodes any file into an `AudioEnvelope`, read
with `envelopeRmsAt`, `envelopePeakAt`, `envelopeBandsAt`,
`envelopeNoveltyAt`, and `envelopeWaveform`.
