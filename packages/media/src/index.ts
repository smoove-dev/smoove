/**
 * @smoove/media — timeline-driven Audio and Video nodes for smoove.
 *
 * Importing this module registers its browser `Mediabunny*` sources as
 * `@smoove/core`'s default source factories (the DI seam lives in core). A
 * server renderer (`@smoove/renderer`) overrides these with Node sources via
 * the same seam and does not import this package.
 */
import {
  isAudioNode as _isAudioNode,
  isVideoNode as _isVideoNode,
  detectEnvironment,
  setDefaultAudioSourceFactory,
  setDefaultVideoSourceFactory,
} from "@smoove/core";
import type Konva from "konva";
import { MediabunnyAudioSource } from "./audio/audio-source-mediabunny.js";
import type { Audio as AudioNode } from "./audio/index.js";
import type { Video as VideoNode } from "./video/index.js";
import { MediabunnyVideoSource } from "./video/video-source-mediabunny.js";

// Skip when a server renderer has already flagged the process as rendering
// (`@smoove/renderer/register` may legitimately be imported before this
// module): its Node factories must not be clobbered by browser sources that
// can't read filesystem paths. In the reverse order (this module first) the
// renderer's setup simply overwrites these — either order lands on the Node
// factories.
if (!detectEnvironment().isRendering) {
  setDefaultAudioSourceFactory(() => new MediabunnyAudioSource());
  setDefaultVideoSourceFactory(() => new MediabunnyVideoSource());
}

export { BrowserAudioSource } from "./audio/audio-source-browser.js";
export {
  MediabunnyAudioSource,
  type SchedulableAudioSource,
} from "./audio/audio-source-mediabunny.js";
export {
  type AudioEnvelope,
  buildEnvelope,
  DEFAULT_WINDOW_HZ,
  envelopeBandsAt,
  envelopeNoveltyAt,
  envelopePeakAt,
  envelopeRmsAt,
  envelopeWaveform,
} from "./audio/envelope.js";
export { Audio } from "./audio/index.js";
export type { AudioConfig } from "./audio/types.js";
export { Video } from "./video/index.js";
export type { VideoConfig } from "./video/types.js";
export { BrowserVideoSource } from "./video/video-source-browser.js";
export { MediabunnyVideoSource } from "./video/video-source-mediabunny.js";

/**
 * Typed guard narrowing to this package's concrete `Audio` node (authoring
 * ergonomics). Core's `isAudioNode` returns a plain boolean.
 */
export function isAudioNode(node: Konva.Node): node is AudioNode {
  return _isAudioNode(node);
}

/** Typed guard narrowing to this package's concrete `Video` node. */
export function isVideoNode(node: Konva.Node): node is VideoNode {
  return _isVideoNode(node);
}
