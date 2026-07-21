import { FilePathSource, type Source, UrlSource } from "mediabunny";

/**
 * Mediabunny source for a media src string. Browser srcs are URLs; server
 * renders resolve Vite asset URLs to filesystem paths (the `mediaSrc` helper),
 * so anything that isn't `http(s)` is treated as a local path — mirrors the
 * renderer's `makeInputSource`.
 */
export function makeInputSource(src: string): Source {
  if (/^https?:\/\//i.test(src)) return new UrlSource(src);
  if (src.startsWith("file://")) return new FilePathSource(new URL(src).pathname);
  // Root-relative/relative srcs: in a browser they're asset URLs (Vite serves
  // them; fetch resolves against the page), in Node they're local paths.
  if (typeof document !== "undefined") return new UrlSource(src);
  return new FilePathSource(src);
}
