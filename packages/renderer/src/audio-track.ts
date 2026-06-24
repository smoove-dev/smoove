import type { AudioAsset, Composition } from "@konva-motion/core";
import type { AudioClip, VolumeKeyframe } from "./types.js";

/**
 * Coalesce the per-frame audio samples collected during a render
 * (`comp.getAudioAssets()`) into clips. Samples are grouped by source id,
 * muted/silent ones dropped, then split into runs of consecutive frames — each
 * run becomes one {@link AudioClip} the {@link mixAudio} pass decodes and mixes.
 */
export function collectAudioTrack(comp: Composition, fps: number): AudioClip[] {
  const audible = comp.getAudioAssets().filter((a) => !a.muted && a.volume > 0);

  const byId = new Map<string, AudioAsset[]>();
  for (const a of audible) {
    const arr = byId.get(a.id);
    if (arr) arr.push(a);
    else byId.set(a.id, [a]);
  }

  const clips: AudioClip[] = [];
  for (const [id, group] of byId) {
    group.sort((x, y) => x.frame - y.frame);
    let run: AudioAsset[] = [];
    let prevFrame = Number.NaN;
    for (const a of group) {
      if (run.length > 0 && a.frame !== prevFrame + 1) {
        clips.push(makeClip(id, run, fps));
        run = [];
      }
      run.push(a);
      prevFrame = a.frame;
    }
    if (run.length > 0) clips.push(makeClip(id, run, fps));
  }

  clips.sort((a, b) => a.startFrame - b.startFrame);
  return clips;
}

function makeClip(id: string, run: AudioAsset[], fps: number): AudioClip {
  const first = run[0] as AudioAsset;
  const last = run[run.length - 1] as AudioAsset;
  const startFrame = first.frame;
  const baseVolume = first.volume;
  const varies = run.some((r) => Math.abs(r.volume - baseVolume) > 1e-6);

  const volume: number | VolumeKeyframe[] = varies
    ? simplifyEnvelope(run.map((r) => ({ time: (r.frame - startFrame) / fps, volume: r.volume })))
    : baseVolume;

  return {
    id,
    src: first.src,
    startFrame,
    endFrame: last.frame,
    mediaInSeconds: first.mediaTime,
    playbackRate: first.playbackRate,
    volume,
  };
}

/**
 * Reduce a dense per-frame volume curve to its breakpoints (Ramer–Douglas–
 * Peucker on vertical error). A linear ramp collapses to two points, a constant
 * run to two — keeping the volume envelope evaluated by the mixer compact while
 * preserving the shape. `eps` is the max allowed volume error (0..1).
 */
export function simplifyEnvelope(kfs: VolumeKeyframe[], eps = 0.015): VolumeKeyframe[] {
  if (kfs.length <= 2) return kfs;
  const keep = new Uint8Array(kfs.length);
  keep[0] = 1;
  keep[kfs.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, kfs.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop() as [number, number];
    const a = kfs[lo] as VolumeKeyframe;
    const b = kfs[hi] as VolumeKeyframe;
    const span = b.time - a.time || 1;
    let maxErr = -1;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const p = kfs[i] as VolumeKeyframe;
      const lineV = a.volume + ((b.volume - a.volume) * (p.time - a.time)) / span;
      const err = Math.abs(p.volume - lineV);
      if (err > maxErr) {
        maxErr = err;
        idx = i;
      }
    }
    if (maxErr > eps && idx >= 0) {
      keep[idx] = 1;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  return kfs.filter((_, i) => keep[i] === 1);
}
