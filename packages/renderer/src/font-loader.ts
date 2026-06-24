import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FontFaceDescriptor, FontLoader } from "@konva-motion/core";
import { FontLibrary } from "skia-canvas";

/** Default on-disk cache for fonts fetched from remote URLs. */
export const DEFAULT_FONT_CACHE_DIR = path.join(tmpdir(), "konva-motion-fonts");

// Process-level dedup of FontLibrary.use() calls. skia accumulates faces into a
// family (and is first-wins per weight/style slot), so re-registering the same
// face is wasted work — track what we've already installed.
const registered = new Set<string>();

function isRemote(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/**
 * Resolve a face `src` to a local file path skia-canvas can load. Local paths
 * pass through; remote URLs are downloaded once into `cacheDir` (keyed by a hash
 * of the URL) and reused on subsequent frames and process runs.
 */
async function resolveToLocalPath(src: string, cacheDir: string): Promise<string> {
  if (!isRemote(src)) return src;
  const ext = path.extname(new URL(src).pathname) || ".font";
  const file = path.join(cacheDir, `${createHash("sha256").update(src).digest("hex")}${ext}`);
  if (existsSync(file)) return file;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`font fetch failed (${res.status}) for ${src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, buf);
  return file;
}

/**
 * Build a {@link FontLoader} backed by skia-canvas `FontLibrary`. Downloads
 * remote font URLs into `cacheDir` (default {@link DEFAULT_FONT_CACHE_DIR}) and
 * registers each face once. Installed by `setupServerRendering` so scene-declared
 * `Font` nodes work headlessly without a DOM `@font-face`.
 */
export function makeSkiaFontLoader(cacheDir: string = DEFAULT_FONT_CACHE_DIR): FontLoader {
  return async (family: string, face: FontFaceDescriptor): Promise<void> => {
    const localPath = await resolveToLocalPath(face.src, cacheDir);
    const key = `${family}|${face.weight}|${face.style}|${localPath}`;
    if (registered.has(key)) return;
    registered.add(key);
    FontLibrary.use(family, [localPath]);
  };
}
