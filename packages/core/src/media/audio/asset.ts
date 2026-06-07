/**
 * A single audio playback sample captured during offline rendering — one per
 * {@link Audio} per rendered frame. The engine never decodes audio while
 * capturing canvas frames; instead the {@link RenderingAudioDriver} records
 * these so an external pass (e.g. ffmpeg) can mux the audio track afterward.
 */
export type AudioAsset = {
  /** Stable id of the source {@link Audio} node. */
  id: string;
  src: string;
  /** Global composition frame this sample is for. */
  frame: number;
  /** Position into the source media, in seconds (from {@link getMediaTime}). */
  mediaTime: number;
  /** Effective level at this frame — `master × intrinsic`, 0..1. */
  volume: number;
  /** Effective mute at this frame — `masterMuted || intrinsicMuted`. */
  muted: boolean;
  playbackRate: number;
};
