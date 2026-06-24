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

let videoFactory: VideoSourceFactory = (): VideoSource => new MediabunnyVideoSource();
let audioFactory: AudioSourceFactory = (): AudioSource => new MediabunnyAudioSource();
let imageLoader: ImageLoader = domLoadImage;

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
