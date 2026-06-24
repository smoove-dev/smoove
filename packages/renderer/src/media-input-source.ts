import { FilePathSource, type Source, UrlSource } from "mediabunny";

/**
 * Build a Mediabunny {@link Source} for a media reference. Server renders feed
 * filesystem paths (and `file://` URLs); remote `http(s)` URLs are fetched via
 * {@link UrlSource}. Anything else is treated as a local path.
 */
export function makeInputSource(src: string): Source {
  if (/^https?:\/\//i.test(src)) return new UrlSource(src);
  if (src.startsWith("file://")) return new FilePathSource(fileUrlToPath(src));
  return new FilePathSource(src);
}

function fileUrlToPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
