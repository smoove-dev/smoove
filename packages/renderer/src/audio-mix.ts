import { ALL_FORMATS, AudioSampleSink, Input } from "mediabunny";
import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from "./encode.js";
import { makeInputSource } from "./media-input-source.js";
import type { AudioClip, VolumeKeyframe } from "./types.js";

/**
 * Decode every {@link AudioClip} and mix it into one interleaved stereo f32 PCM
 * timeline at {@link AUDIO_SAMPLE_RATE}. Replaces the ffmpeg
 * `atrim/atempo/volume/adelay/amix` filtergraph: each clip is decoded with a
 * Mediabunny {@link AudioSampleSink}, resampled for its playback rate + source
 * rate, gain-shaped by its volume envelope, delayed to its start frame, and
 * summed. The result is fed to the encoder as {@link AudioSample}s.
 *
 * Returns `null` when nothing decodes to audible PCM (so the caller can skip the
 * audio track entirely).
 */
export async function mixAudio(
  clips: AudioClip[],
  fps: number,
  totalSeconds: number,
  fromFrame = 0,
): Promise<Float32Array | null> {
  if (clips.length === 0) return null;
  const totalFrames = Math.ceil(totalSeconds * AUDIO_SAMPLE_RATE);
  const mix = new Float32Array(totalFrames * AUDIO_CHANNELS);
  let mixed = 0;

  for (const clip of clips) {
    mixed += await mixClip(mix, totalFrames, clip, fps, fromFrame);
  }
  if (mixed === 0) return null;

  // Sum can exceed unity when clips overlap; clamp so the encoder gets valid PCM.
  for (let i = 0; i < mix.length; i++) {
    const v = mix[i] as number;
    mix[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return mix;
}

/** Decode one clip and add it into `mix`. Returns the number of frames written. */
async function mixClip(
  mix: Float32Array,
  totalFrames: number,
  clip: AudioClip,
  fps: number,
  fromFrame: number,
): Promise<number> {
  const compDurSec = (clip.endFrame - clip.startFrame + 1) / fps;
  const srcDurSec = compDurSec * clip.playbackRate;
  const startSec = (clip.startFrame - fromFrame) / fps;

  const input = new Input({ formats: ALL_FORMATS, source: makeInputSource(clip.src) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return 0;
    const sink = new AudioSampleSink(track);

    // Decode the consumed source region into contiguous per-channel buffers.
    const parts: { ts: number; data: Float32Array; frames: number }[] = [];
    let srcChannels = 0;
    let srcRate = 0;
    for await (const s of sink.samples(clip.mediaInSeconds, clip.mediaInSeconds + srcDurSec)) {
      srcChannels = s.numberOfChannels;
      srcRate = s.sampleRate;
      const buf = new Float32Array(s.allocationSize({ planeIndex: 0, format: "f32" }) / 4);
      s.copyTo(buf, { planeIndex: 0, format: "f32" });
      parts.push({ ts: s.timestamp, data: buf, frames: s.numberOfFrames });
      s.close();
    }
    if (parts.length === 0 || srcChannels === 0) return 0;

    const totalSrc = parts.reduce((n, p) => n + p.frames, 0);
    const chans: Float32Array[] = Array.from(
      { length: srcChannels },
      () => new Float32Array(totalSrc),
    );
    let w = 0;
    for (const p of parts) {
      for (let i = 0; i < p.frames; i++) {
        const base = i * srcChannels;
        for (let c = 0; c < srcChannels; c++)
          (chans[c] as Float32Array)[w + i] = p.data[base + c] as number;
      }
      w += p.frames;
    }
    const origin = (parts[0] as { ts: number }).ts;

    const left = chans[0] as Float32Array;
    const right = (srcChannels > 1 ? chans[1] : chans[0]) as Float32Array;
    const outStart = Math.round(startSec * AUDIO_SAMPLE_RATE);
    const outLen = Math.round(compDurSec * AUDIO_SAMPLE_RATE);
    let written = 0;

    for (let i = 0; i < outLen; i++) {
      const outIdx = outStart + i;
      if (outIdx < 0 || outIdx >= totalFrames) continue;
      const compRel = i / AUDIO_SAMPLE_RATE;
      const srcAbs = clip.mediaInSeconds + compRel * clip.playbackRate;
      const pos = (srcAbs - origin) * srcRate;
      const i0 = Math.floor(pos);
      if (i0 < 0 || i0 >= totalSrc) continue;
      const frac = pos - i0;
      const vol = evalVolume(clip.volume, compRel);
      const li = outIdx * 2;
      mix[li] = (mix[li] as number) + sampleAt(left, i0, frac, totalSrc) * vol;
      mix[li + 1] = (mix[li + 1] as number) + sampleAt(right, i0, frac, totalSrc) * vol;
      written++;
    }
    return written;
  } finally {
    input.dispose();
  }
}

/** Linear interpolation between frame `i0` and `i0+1`, holding the last frame. */
function sampleAt(buf: Float32Array, i0: number, frac: number, len: number): number {
  const a = buf[i0] as number;
  if (i0 + 1 >= len || frac === 0) return a;
  const b = buf[i0 + 1] as number;
  return a + (b - a) * frac;
}

/** Evaluate a constant level or piecewise-linear envelope at clip-relative time `t` (seconds). */
function evalVolume(volume: number | VolumeKeyframe[], t: number): number {
  if (typeof volume === "number") return volume;
  if (volume.length === 0) return 1;
  if (volume.length === 1) return (volume[0] as VolumeKeyframe).volume;
  const first = volume[0] as VolumeKeyframe;
  if (t <= first.time) return first.volume;
  for (let i = 1; i < volume.length; i++) {
    const b = volume[i] as VolumeKeyframe;
    if (t <= b.time) {
      const a = volume[i - 1] as VolumeKeyframe;
      const span = b.time - a.time || 1;
      return a.volume + ((b.volume - a.volume) * (t - a.time)) / span;
    }
  }
  return (volume[volume.length - 1] as VolumeKeyframe).volume;
}
