import {
  setDefaultAudioSourceFactory,
  setDefaultImageLoader,
  setDefaultVideoSourceFactory,
} from "@konva-motion/core";
import { FontLibrary } from "skia-canvas";
import { nullAudioSourceFactory } from "./audio-source-null.js";
import { loadImageNode } from "./image-loader.js";
import { registerServerMedia } from "./media-server.js";
import { installSkiaBackend } from "./skia.js";
import type { FontsOption, SetupOptions } from "./types.js";
import { nodeVideoSourceFactory, setVideoDecodeCap } from "./video-source-mediabunny.js";

const RENDERING_FLAG = "__KONVA_MOTION_RENDERING__";
let factoriesRegistered = false;

/** Register fonts with skia-canvas so `Text` nodes can use them (no DOM `@font-face`). */
export function registerFonts(fonts?: FontsOption): void {
  if (!fonts) return;
  if (Array.isArray(fonts)) FontLibrary.use(fonts);
  else FontLibrary.use(fonts as Record<string, string | readonly string[]>);
}

/**
 * Install everything needed to render a `Composition` headlessly in Node:
 * the konva skia backend, the global rendering flag, and Node-safe default
 * video/audio source factories + image loader (so media nodes construct without
 * a DOM). Idempotent — call it (or import `@konva-motion/renderer/register`)
 * **before** constructing any composition.
 */
export function setupServerRendering(opts: SetupOptions = {}): void {
  installSkiaBackend();
  registerServerMedia();
  (globalThis as Record<string, unknown>)[RENDERING_FLAG] = true;
  if (!factoriesRegistered) {
    setDefaultVideoSourceFactory(opts.video ?? nodeVideoSourceFactory);
    setDefaultAudioSourceFactory(nullAudioSourceFactory);
    setDefaultImageLoader(loadImageNode);
    factoriesRegistered = true;
  } else if (opts.video) {
    setDefaultVideoSourceFactory(opts.video);
  }
  if (opts.videoDecodeCap) {
    setVideoDecodeCap(opts.videoDecodeCap.width, opts.videoDecodeCap.height);
  }
  registerFonts(opts.fonts);
}
