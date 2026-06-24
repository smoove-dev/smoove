/**
 * Globally-overridable factories for the media sources and image loader that
 * nodes build at construction time. The browser is the default everywhere; a
 * server renderer swaps in Node-safe implementations **before** any composition
 * is constructed (e.g. `@konva-motion/renderer`'s `setupServerRendering()`),
 * since the browser defaults ({@link MediabunnyAudioSource}/
 * {@link MediabunnyVideoSource}) rely on `document`/WebCodecs and would throw in Node.
 */

import { MediabunnyAudioSource } from "../media/audio/audio-source-mediabunny.js";
import type { AudioSource, AudioSourceFactory } from "../media/audio/audio-source.js";
import { MediabunnyVideoSource } from "../media/video/video-source-mediabunny.js";
import type { VideoSource, VideoSourceFactory } from "../media/video/video-source.js";

/** A drawable, loaded image with intrinsic dimensions — what {@link ImageLoader} resolves. */
export type LoadedImage = CanvasImageSource & {
  readonly naturalWidth: number;
  readonly naturalHeight: number;
};

/** Loads an image source string into a drawable. Defaults to the DOM `<img>` loader. */
export type ImageLoader = (src: string) => Promise<LoadedImage>;

function domLoadImage(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * A single, resolved font face — what {@link FontLoader} receives. `weight` and
 * `style` are normalized strings (e.g. `"400"`, `"italic"`); `src` is a font
 * file URL (browser) or path/URL (server). Mirrors `Font`'s internal face shape
 * without importing it (which would cycle: `font.ts` imports this module).
 */
export type FontFaceDescriptor = {
  readonly weight: string;
  readonly style: string;
  readonly src: string;
};

/**
 * Loads one font face into the active text backend. Defaults to the browser
 * `FontFace` API; a server renderer swaps in a skia-canvas implementation via
 * {@link setDefaultFontLoader}. Always call faces through {@link loadFontFace},
 * not this directly — that adds dedup so each face loads at most once.
 */
export type FontLoader = (family: string, face: FontFaceDescriptor) => Promise<void>;

function domLoadFont(family: string, face: FontFaceDescriptor): Promise<void> {
  // The FontFace API force-fetches and parses the binary — canvas text does NOT
  // trigger CSS @font-face lazy loading, so this is the reliable path for Konva.
  // Remote URLs are HTTP-cached by the browser; remote hosts must send CORS
  // headers or `.load()` rejects.
  const ff = new FontFace(family, `url(${face.src})`, {
    weight: face.weight,
    style: face.style,
  });
  return ff.load().then((loaded) => {
    (document as Document & { fonts: { add(f: FontFace): void } }).fonts.add(loaded);
  });
}

let videoFactory: VideoSourceFactory = (): VideoSource => new MediabunnyVideoSource();
let audioFactory: AudioSourceFactory = (): AudioSource => new MediabunnyAudioSource();
let imageLoader: ImageLoader = domLoadImage;
let fontLoader: FontLoader = domLoadFont;

/** Deduped face loads, keyed by `family|weight|style|src` — see {@link loadFontFace}. */
const fontCache = new Map<string, Promise<void>>();

export function setDefaultVideoSourceFactory(factory: VideoSourceFactory): void {
  videoFactory = factory;
}
export function getDefaultVideoSourceFactory(): VideoSourceFactory {
  return videoFactory;
}

export function setDefaultAudioSourceFactory(factory: AudioSourceFactory): void {
  audioFactory = factory;
}
export function getDefaultAudioSourceFactory(): AudioSourceFactory {
  return audioFactory;
}

export function setDefaultImageLoader(loader: ImageLoader): void {
  imageLoader = loader;
}
export function getDefaultImageLoader(): ImageLoader {
  return imageLoader;
}

export function setDefaultFontLoader(loader: FontLoader): void {
  fontLoader = loader;
}
export function getDefaultFontLoader(): FontLoader {
  return fontLoader;
}

/**
 * Load a single font face through the active {@link FontLoader}, deduped by
 * `family|weight|style|src` so the same face is fetched/registered at most once
 * across every `Font`, `Text`, and re-render. Returns the shared promise.
 */
export function loadFontFace(family: string, face: FontFaceDescriptor): Promise<void> {
  const key = `${family}|${face.weight}|${face.style}|${face.src}`;
  let p = fontCache.get(key);
  if (!p) {
    p = fontLoader(family, face);
    fontCache.set(key, p);
  }
  return p;
}
